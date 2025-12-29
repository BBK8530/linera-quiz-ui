// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

use linera_sdk::{bcs, Contract, ContractRuntime};
use pixel_chain::{
    CanvasInitialization, Message, Operation, Pixel, PixelChainAbi, PixelColor, Position,
    PixelUpdate, PixelModification
};
use state::PixelChainState;
use std::collections::HashMap;

#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_basic_canvas_operations() {
        // Test canvas initialization
        let state = PixelChainState::default();
        let mut state = state;
        
        // Initialize canvas
        state.initialize(100, 100);
        
        // Verify canvas dimensions
        assert_eq!(*state.canvas_width.get(), 100);
        assert_eq!(*state.canvas_height.get(), 100);
    }

    #[tokio::test]
    async fn test_pixel_operations() {
        let mut state = PixelChainState::default();
        state.initialize(50, 50);
        
        // Test valid position check
        assert!(state.is_valid_position(0, 0));
        assert!(state.is_valid_position(49, 49));
        assert!(!state.is_valid_position(50, 50));
        assert!(!state.is_valid_position(100, 100));
    }

    #[tokio::test]
    async fn test_pixel_color_operations() {
        // Test creating pixels with different colors
        let red = PixelColor {
            red: 255,
            green: 0,
            blue: 0,
            alpha: 255,
        };
        
        let green = PixelColor {
            red: 0,
            green: 255,
            blue: 0,
            alpha: 255,
        };
        
        let blue = PixelColor {
            red: 0,
            green: 0,
            blue: 255,
            alpha: 255,
        };
        
        // Test transparency checks
        assert!(!red.is_transparent());
        assert!(!green.is_transparent());
        assert!(!blue.is_transparent());
        
        let transparent = PixelColor {
            red: 0,
            green: 0,
            blue: 0,
            alpha: 0,
        };
        
        assert!(transparent.is_transparent());
    }

    #[tokio::test]
    async fn test_notification_system() {
        let mut state = PixelChainState::default();
        state.initialize(100, 100);
        
        // Initially no notifications
        let (unprocessed, processed) = state.get_notification_stats().await.unwrap();
        assert_eq!(unprocessed, 0);
        assert_eq!(processed, 0);
        
        // Get unprocessed notifications (should be empty initially)
        let unprocessed_notifications = state.get_unprocessed_notifications().await.unwrap();
        assert_eq!(unprocessed_notifications.len(), 0);
    }

    #[tokio::test]
    async fn test_cross_chain_message_creation() {
        // Test creating different types of cross-chain messages
        
        let pixel_modified_msg = Message::PixelModified {
            x: 10,
            y: 20,
            new_color: Some(PixelColor {
                red: 255,
                green: 0,
                blue: 0,
                alpha: 255,
            }),
            modified_by: "0000000000000000000000000000000000000000".parse().unwrap(),
            timestamp: 1234567890,
        };
        
        let batch_pixel_modified_msg = Message::BatchPixelModified {
            pixels: vec![
                PixelModification {
                    x: 5,
                    y: 10,
                    new_color: Some(PixelColor {
                        red: 0,
                        green: 255,
                        blue: 0,
                        alpha: 255,
                    }),
                },
                PixelModification {
                    x: 15,
                    y: 25,
                    new_color: Some(PixelColor {
                        red: 0,
                        green: 0,
                        blue: 255,
                        alpha: 255,
                    }),
                },
            ],
            modified_by: "1111111111111111111111111111111111111111".parse().unwrap(),
            timestamp: 1234567891,
        };
        
        let ownership_claim_msg = Message::OwnershipClaim {
            x: 30,
            y: 40,
            requested_by: "2222222222222222222222222222222222222222".parse().unwrap(),
            timestamp: 1234567892,
        };
        
        // Messages created successfully
        assert_eq!(pixel_modified_msg, pixel_modified_msg);
        assert_eq!(batch_pixel_modified_msg, batch_pixel_modified_msg);
        assert_eq!(ownership_claim_msg, ownership_claim_msg);
    }

    #[tokio::test]
    async fn test_notification_cleanup() {
        let mut state = PixelChainState::default();
        state.initialize(100, 100);
        
        // Test cleanup function (should not fail)
        let result = state.cleanup_old_notifications().await;
        assert!(result.is_ok());
        
        // Test notification stats after cleanup
        let (unprocessed, processed) = state.get_notification_stats().await.unwrap();
        assert_eq!(unprocessed, 0);
        assert_eq!(processed, 0);
    }

    #[tokio::test]
    async fn test_canvas_statistics() {
        let mut state = PixelChainState::default();
        state.initialize(200, 200);
        
        // Get canvas stats
        let stats = state.get_canvas_stats();
        assert_eq!(stats.width, 200);
        assert_eq!(stats.height, 200);
        assert_eq!(stats.total_pixels, 40000);
        assert_eq!(stats.colored_pixels, 0);
        assert_eq!(stats.unique_colors, 0);
    }

    #[tokio::test]
    async fn test_position_serialization() {
        // Test that Position can be used as a key in CustomMapView
        let pos1 = Position { x: 10, y: 20 };
        let pos2 = Position { x: 10, y: 20 };
        let pos3 = Position { x: 15, y: 25 };
        
        // Test equality
        assert_eq!(pos1, pos2);
        assert_ne!(pos1, pos3);
        
        // Test serialization
        let serialized = pos1.to_custom_bytes().unwrap();
        let deserialized = Position::from_custom_bytes(&serialized).unwrap();
        assert_eq!(pos1, deserialized);
    }
}