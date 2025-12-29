// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    linera_base_types::{StreamUpdate, WithContractAbi, ChainId, Timestamp},
    views::{RootView, View},
    Contract, ContractRuntime,
};
use pixel_chain::{Message, Operation, Pixel, PixelChainAbi, PixelColor, Position};
use state::PixelChainState;

/// The stream name the application uses for events about pixel changes.
const STREAM_NAME: &[u8] = b"pixel_changes";

pub struct PixelChainContract {
    state: PixelChainState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(PixelChainContract);

impl WithContractAbi for PixelChainContract {
    type Abi = PixelChainAbi;
}

impl Contract for PixelChainContract {
    type Message = Message;
    type InstantiationArgument = CanvasInitialization;
    type Parameters = ();
    type EventValue = Event;

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = PixelChainState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        PixelChainContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: CanvasInitialization) {
        // Validate that the application parameters were configured correctly.
        self.runtime.application_parameters();

        // Initialize the canvas with the provided dimensions
        self.state
            .initialize(argument.width, argument.height);
    }

    async fn execute_operation(&mut self, operation: Operation) -> Self::Response {
        match operation {
            Operation::SetPixel { x, y, color } => {
                self.execute_set_pixel(x, y, color).await
            }
            Operation::ClearPixel { x, y } => {
                self.execute_clear_pixel(x, y).await
            }
            Operation::SetPixels { pixels } => {
                self.execute_set_pixels(pixels).await
            }
        }
    }

    async fn execute_message(&mut self, message: Message) {
        match message {
            Message::PixelModified { x, y, new_color, modified_by, timestamp } => {
                self.handle_pixel_modification_notification(x, y, new_color, modified_by, timestamp).await
            }
            Message::BatchPixelModified { pixels, modified_by, timestamp } => {
                self.handle_batch_pixel_modification_notification(pixels, modified_by, timestamp).await
            }
            Message::OwnershipClaim { x, y, requested_by, timestamp } => {
                self.handle_ownership_claim(x, y, requested_by, timestamp).await
            }
        }
    }

    async fn process_streams(&mut self, _updates: Vec<StreamUpdate>) {
        // This application doesn't subscribe to streams
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl PixelChainContract {
    async fn execute_set_pixel(&mut self, x: u32, y: u32, color: PixelColor) {
        if !self.state.is_valid_position(x, y) {
            panic!("Pixel coordinates ({}, {}) are out of bounds", x, y);
        }

        let position = Position { x, y };
        let timestamp = self.runtime.system_time();
        let chain_id = self.runtime.chain_id();

        // Get old pixel state
        let old_pixel = self.state.pixels.get(&position).await.ok().flatten();
        
        // Check ownership and permissions
        let notification_required = if let Some(ref pixel) = old_pixel {
            // If there's an existing owner different from current chain, notify them
            pixel.owner.as_ref() != Some(&chain_id)
        } else {
            false
        };

        // Create new pixel
        let pixel = Pixel {
            x,
            y,
            color: Some(color.clone()),
            owner: Some(chain_id),
            timestamp,
        };

        // Update state
        self.state.pixels.insert(&position, pixel).expect("Failed to insert pixel");
        
        // Add to update log
        self.state.pixel_updates.push(pixel_chain::PixelUpdate { x, y, color: color.clone() });
        
        // Update statistics
        self.state.update_stats(
            old_pixel.as_ref().and_then(|p| p.color.clone()),
            Some(color.clone())
        ).await.expect("Failed to update statistics");

        // Send notification to previous owner if needed
        if notification_required {
            if let Some(old_owner) = old_pixel.as_ref().and_then(|p| p.owner.clone()) {
                let notification = Message::PixelModified {
                    x,
                    y,
                    new_color: Some(color.clone()),
                    modified_by: chain_id,
                    timestamp,
                };
                self.runtime.send_message(old_owner, notification);
            }
        }

        // Emit event
        self.runtime.emit(STREAM_NAME.into(), &Event::PixelChanged { x, y, color });
    }

    async fn execute_clear_pixel(&mut self, x: u32, y: u32) {
        if !self.state.is_valid_position(x, y) {
            panic!("Pixel coordinates ({}, {}) are out of bounds", x, y);
        }

        let position = Position { x, y };
        let timestamp = self.runtime.system_time();
        let chain_id = self.runtime.chain_id();

        // Get old pixel state
        let old_pixel = self.state.pixels.get(&position).await.ok().flatten();

        // Create cleared pixel (transparent)
        let cleared_color = self.state.get_default_color();
        let pixel = Pixel {
            x,
            y,
            color: None, // None represents cleared/transparent pixel
            owner: Some(chain_id),
            timestamp,
        };

        // Update state
        self.state.pixels.insert(&position, pixel).expect("Failed to insert pixel");
        
        // Add to update log
        self.state.pixel_updates.push(pixel_chain::PixelUpdate { x, y, color: cleared_color });
        
        // Update statistics
        self.state.update_stats(
            old_pixel.and_then(|p| p.color),
            None
        ).await.expect("Failed to update statistics");

        // Emit event
        self.runtime.emit(STREAM_NAME.into(), &Event::PixelCleared { x, y });
    }

    async fn execute_set_pixels(&mut self, pixels: Vec<pixel_chain::PixelUpdate>) {
        let pixel_count = pixels.len() as u32;
        
        for pixel_update in pixels.iter() {
            let (x, y, color) = (pixel_update.x, pixel_update.y, pixel_update.color.clone());
            
            if !self.state.is_valid_position(x, y) {
                // Skip invalid pixels but continue processing others
                continue;
            }

            let position = Position { x, y };
            let timestamp = self.runtime.system_time();
            let chain_id = self.runtime.chain_id();

            // Get old pixel state
            let old_pixel = self.state.pixels.get(&position).await.ok().flatten();

            // Create new pixel
            let pixel = Pixel {
                x,
                y,
                color: Some(color.clone()),
                owner: Some(chain_id),
                timestamp,
            };

            // Update state
            self.state.pixels.insert(&position, pixel).expect("Failed to insert pixel");
            
            // Add to update log
            self.state.pixel_updates.push(pixel_chain::PixelUpdate { x, y, color: color.clone() });
            
            // Update statistics
            self.state.update_stats(
                old_pixel.and_then(|p| p.color),
                Some(color)
            ).await.expect("Failed to update statistics");
        }

        // Emit batch update event
        self.runtime.emit(STREAM_NAME.into(), &Event::BatchUpdate { 
            count: pixels.len() as u32 
        });
    }

    /// Handle cross-chain pixel modification notifications
    async fn handle_pixel_modification_notification(
        &mut self,
        x: u32,
        y: u32,
        new_color: Option<PixelColor>,
        modified_by: ChainId,
        timestamp: Timestamp,
    ) {
        // Record the notification in the state
        let notification_color = new_color.clone();
        self.state.cross_chain_notifications.push(pixel_chain::Notification {
            notification_type: "pixel_modified".to_string(),
            x,
            y,
            new_color: notification_color.clone(),
            modified_by,
            timestamp,
            processed: false,
        });

        // Emit an event to notify local subscribers about the cross-chain modification
        if let Some(color) = notification_color {
            self.runtime.emit(STREAM_NAME.into(), &Event::CrossChainPixelModified {
                x,
                y,
                color,
                modified_by,
            });
        } else {
            self.runtime.emit(STREAM_NAME.into(), &Event::CrossChainPixelCleared {
                x,
                y,
                modified_by,
            });
        }
    }

    /// Handle cross-chain batch pixel modification notifications
    async fn handle_batch_pixel_modification_notification(
        &mut self,
        pixels: Vec<pixel_chain::PixelModification>,
        modified_by: ChainId,
        timestamp: Timestamp,
    ) {
        // Record the batch notification in the state
        for pixel_mod in &pixels {
            self.state.cross_chain_notifications.push(pixel_chain::Notification {
                notification_type: "batch_pixel_modified".to_string(),
                x: pixel_mod.x,
                y: pixel_mod.y,
                new_color: pixel_mod.new_color.clone(),
                modified_by,
                timestamp,
                processed: false,
            });
        }

        // Emit a batch notification event
        self.runtime.emit(STREAM_NAME.into(), &Event::CrossChainBatchModified {
            count: pixels.len() as u32,
            modified_by,
        });
    }

    /// Handle cross-chain ownership claim notifications
    async fn handle_ownership_claim(
        &mut self,
        x: u32,
        y: u32,
        requested_by: ChainId,
        timestamp: Timestamp,
    ) {
        // Record the ownership claim in the state
        self.state.cross_chain_notifications.push(pixel_chain::Notification {
            notification_type: "ownership_claim".to_string(),
            x,
            y,
            new_color: None,
            modified_by: requested_by,
            timestamp,
            processed: false,
        });

        // Check if the position is valid
        if !self.state.is_valid_position(x, y) {
            return;
        }

        let position = Position { x, y };

        // Check current ownership status
        let current_pixel = self.state.pixels.get(&position).await.ok().flatten();

        match current_pixel {
            Some(pixel) => {
                // Pixel exists, send response to claimant about current status
                let response = if pixel.owner == Some(requested_by) {
                    // Already owned by this chain
                    Message::OwnershipClaim {
                        x,
                        y,
                        requested_by,
                        timestamp: self.runtime.system_time(),
                    }
                } else {
                    // Send current ownership info
                    Message::PixelModified {
                        x,
                        y,
                        new_color: pixel.color,
                        modified_by: pixel.owner.unwrap_or(requested_by),
                        timestamp: pixel.timestamp,
                    }
                };
                
                self.runtime.send_message(requested_by, response);
            }
            None => {
                // Pixel is unclaimed, grant ownership to claimant
                let pixel = Pixel {
                    x,
                    y,
                    color: None, // Start as uncolored
                    owner: Some(requested_by),
                    timestamp,
                };

                // Update state with new ownership
                self.state.pixels.insert(&position, pixel).expect("Failed to insert pixel");
                
                // Confirm ownership grant
                let confirmation = Message::OwnershipClaim {
                    x,
                    y,
                    requested_by,
                    timestamp: self.runtime.system_time(),
                };
                self.runtime.send_message(requested_by, confirmation);

                // Emit ownership change event
                self.runtime.emit(STREAM_NAME.into(), &Event::OwnershipChanged {
                    x,
                    y,
                    new_owner: Some(requested_by),
                    old_owner: None,
                });
            }
        }
    }
}

/// Canvas initialization parameters
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CanvasInitialization {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum Event {
    /// A pixel was changed to a new color
    PixelChanged {
        x: u32,
        y: u32,
        color: PixelColor,
    },
    /// A pixel was cleared (set to transparent)
    PixelCleared {
        x: u32,
        y: u32,
    },
    /// A batch of pixels was updated
    BatchUpdate {
        count: u32,
    },
    /// Cross-chain pixel modification notification
    CrossChainPixelModified {
        x: u32,
        y: u32,
        color: PixelColor,
        modified_by: ChainId,
    },
    /// Cross-chain pixel clearing notification
    CrossChainPixelCleared {
        x: u32,
        y: u32,
        modified_by: ChainId,
    },
    /// Cross-chain batch modification notification
    CrossChainBatchModified {
        count: u32,
        modified_by: ChainId,
    },
    /// Ownership change notification
    OwnershipChanged {
        x: u32,
        y: u32,
        new_owner: Option<ChainId>,
        old_owner: Option<ChainId>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use pixel_chain::{Operation, PixelColor};
    use futures::FutureExt as _;
    use linera_sdk::{util::BlockingWait, Contract, ContractRuntime};

    #[test]
    fn test_set_pixel_operation() {
        let initialization = CanvasInitialization {
            width: 100,
            height: 100,
        };
        let mut contract = create_and_instantiate_canvas(initialization);

        let x = 50;
        let y = 25;
        let color = PixelColor::new(255, 0, 0, 255); // Red pixel

        let operation = Operation::SetPixel { x, y, color };

        let response = contract
            .execute_operation(operation)
            .now_or_never()
            .expect("Execution should not await anything");

        assert_eq!(response, ());
    }

    #[test]
    fn test_clear_pixel_operation() {
        let initialization = CanvasInitialization {
            width: 100,
            height: 100,
        };
        let mut contract = create_and_instantiate_canvas(initialization);

        // First set a pixel
        let x = 50;
        let y = 25;
        let color = PixelColor::new(255, 0, 0, 255);
        let set_operation = Operation::SetPixel { x, y, color };
        contract
            .execute_operation(set_operation)
            .now_or_never()
            .expect("Set pixel should not await");

        // Then clear it
        let clear_operation = Operation::ClearPixel { x, y };
        let response = contract
            .execute_operation(clear_operation)
            .now_or_never()
            .expect("Clear pixel should not await");

        assert_eq!(response, ());
    }

    #[test]
    fn test_batch_set_pixels() {
        let initialization = CanvasInitialization {
            width: 100,
            height: 100,
        };
        let mut contract = create_and_instantiate_canvas(initialization);

        let pixels = vec![
            pixel_chain::PixelUpdate {
                x: 0,
                y: 0,
                color: PixelColor::new(255, 0, 0, 255),
            },
            pixel_chain::PixelUpdate {
                x: 1,
                y: 0,
                color: PixelColor::new(0, 255, 0, 255),
            },
            pixel_chain::PixelUpdate {
                x: 2,
                y: 0,
                color: PixelColor::new(0, 0, 255, 255),
            },
        ];

        let operation = Operation::SetPixels { pixels };

        let response = contract
            .execute_operation(operation)
            .now_or_never()
            .expect("Batch set pixels should not await");

        assert_eq!(response, ());
    }

    #[test]
    #[should_panic(expected = "out of bounds")]
    fn test_out_of_bounds_pixel() {
        let initialization = CanvasInitialization {
            width: 100,
            height: 100,
        };
        let mut contract = create_and_instantiate_canvas(initialization);

        let x = 150; // Out of bounds
        let y = 25;
        let color = PixelColor::new(255, 0, 0, 255);

        let operation = Operation::SetPixel { x, y, color };

        contract
            .execute_operation(operation)
            .now_or_never()
            .expect("Should panic on out of bounds pixel");
    }

    fn create_and_instantiate_canvas(initialization: CanvasInitialization) -> PixelChainContract {
        let runtime = ContractRuntime::new().with_application_parameters(());
        let mut contract = PixelChainContract {
            state: PixelChainState::load(runtime.root_view_storage_context())
                .blocking_wait()
                .expect("Failed to read from mock key value store"),
            runtime,
        };

        contract
            .instantiate(initialization)
            .now_or_never()
            .expect("Initialization should not await anything");

        contract
    }
}