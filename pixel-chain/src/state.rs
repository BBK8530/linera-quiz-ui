// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use linera_sdk::views::{linera_views, CustomMapView, LogView, RegisterView, RootView, View, ViewStorageContext};
use pixel_chain::{CanvasStats, Pixel, PixelColor, Position, PixelUpdate, Notification};

/// The application state.
#[derive(RootView, async_graphql::SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct PixelChainState {
    /// Canvas dimensions
    pub canvas_width: RegisterView<u32>,
    pub canvas_height: RegisterView<u32>,
    
    /// All pixels on the canvas, stored by position
    pub pixels: CustomMapView<Position, Pixel>,
    
    /// Log of all pixel updates for history
    pub pixel_updates: LogView<PixelUpdate>,
    
    /// Total number of colored pixels
    pub colored_pixel_count: RegisterView<u32>,
    
    /// Canvas statistics
    pub canvas_stats: RegisterView<CanvasStats>,
    
    /// Default color for transparent pixels
    pub default_color: RegisterView<PixelColor>,
    
    /// Log of cross-chain notifications
    pub cross_chain_notifications: LogView<Notification>,
}

impl PixelChainState {
    /// Initialize the state with canvas dimensions
    pub fn initialize(&mut self, width: u32, height: u32) {
        self.canvas_width.set(width);
        self.canvas_height.set(height);
        
        // Set default color to transparent
        let default_color = PixelColor::new(0, 0, 0, 0);
        self.default_color.set(default_color);
        
        // Initialize canvas stats
        let stats = CanvasStats {
            total_pixels: width * height,
            colored_pixels: 0,
            transparent_pixels: width * height,
            unique_colors: 0,
            last_update: None,
        };
        self.canvas_stats.set(stats);
        self.colored_pixel_count.set(0);
    }
    
    /// Check if coordinates are within canvas bounds
    pub fn is_valid_position(&self, x: u32, y: u32) -> bool {
        x < *self.canvas_width.get() && y < *self.canvas_height.get()
    }
    
    /// Get current canvas dimensions
    pub fn get_canvas_dimensions(&self) -> (u32, u32) {
        (*self.canvas_width.get(), *self.canvas_height.get())
    }
    
    /// Get default color
    pub fn get_default_color(&self) -> PixelColor {
        self.default_color.get().clone()
    }
    
    /// Get current canvas statistics
    pub fn get_canvas_stats(&self) -> CanvasStats {
        self.canvas_stats.get().clone()
    }
    
    /// Update canvas statistics after a pixel change
    pub async fn update_stats(&mut self, old_color: Option<PixelColor>, new_color: Option<PixelColor>) -> Result<(), linera_sdk::views::ViewError> {
        let mut stats = self.canvas_stats.get().clone();
        
        // Update colored pixel count
        let was_colored = old_color.map(|c| !c.is_transparent()).unwrap_or(false);
        let is_colored = new_color.map(|c| !c.is_transparent()).unwrap_or(false);
        
        if was_colored && !is_colored {
            // Pixel was cleared
            self.colored_pixel_count.set(*self.colored_pixel_count.get() - 1);
        } else if !was_colored && is_colored {
            // Pixel was colored
            self.colored_pixel_count.set(*self.colored_pixel_count.get() + 1);
        }
        
        // Update stats
        stats.colored_pixels = *self.colored_pixel_count.get();
        stats.transparent_pixels = stats.total_pixels - stats.colored_pixels;
        stats.last_update = Some(linera_sdk::linera_base_types::Timestamp::now());
        
        self.canvas_stats.set(stats);
        Ok(())
    }
    
    /// Get unprocessed cross-chain notifications
    pub async fn get_unprocessed_notifications(&self) -> Result<Vec<Notification>, linera_sdk::views::ViewError> {
        let mut notifications = Vec::new();
        let count = self.cross_chain_notifications.count() as usize;
        
        for i in 0..count {
            if let Some(notification) = self.cross_chain_notifications.get(i).await? {
                if !notification.processed {
                    notifications.push(notification);
                }
            }
        }
        
        Ok(notifications)
    }
    
    /// Mark a notification as processed by recreating the log with the modified notification
    pub async fn mark_notification_processed(&mut self, index: usize) -> Result<(), linera_sdk::views::ViewError> {
        let total_count = self.cross_chain_notifications.count() as usize;
        
        if index >= total_count {
            return Err(linera_sdk::views::ViewError::NotFound("Notification index out of bounds".to_string()));
        }
        
        let mut notifications = Vec::new();
        
        // Collect all notifications, marking the specified one as processed
        for i in 0..total_count {
            if let Some(mut notification) = self.cross_chain_notifications.get(i).await? {
                if i == index {
                    notification.processed = true;
                }
                notifications.push(notification);
            }
        }
        
        // Clear and re-insert all notifications
        self.cross_chain_notifications.clear();
        for notification in notifications {
            self.cross_chain_notifications.push(notification);
        }
        
        Ok(())
    }
    
    /// Mark multiple notifications as processed
    pub async fn mark_notifications_processed(&mut self, indices: &[usize]) -> Result<(), linera_sdk::views::ViewError> {
        let total_count = self.cross_chain_notifications.count() as usize;
        let indices_to_mark: std::collections::HashSet<usize> = indices.iter().cloned().collect();
        
        let mut notifications = Vec::new();
        
        // Collect all notifications, marking specified ones as processed
        for i in 0..total_count {
            if let Some(mut notification) = self.cross_chain_notifications.get(i).await? {
                if indices_to_mark.contains(&i) {
                    notification.processed = true;
                }
                notifications.push(notification);
            }
        }
        
        // Clear and re-insert all notifications
        self.cross_chain_notifications.clear();
        for notification in notifications {
            self.cross_chain_notifications.push(notification);
        }
        
        Ok(())
    }
    
    /// Mark all notifications as processed
    pub async fn mark_all_notifications_processed(&mut self) -> Result<(), linera_sdk::views::ViewError> {
        let total_count = self.cross_chain_notifications.count() as usize;
        let mut notifications = Vec::new();
        
        // Collect all notifications and mark them as processed
        for i in 0..total_count {
            if let Some(mut notification) = self.cross_chain_notifications.get(i).await? {
                notification.processed = true;
                notifications.push(notification);
            }
        }
        
        // Clear and re-insert all notifications
        self.cross_chain_notifications.clear();
        for notification in notifications {
            self.cross_chain_notifications.push(notification);
        }
        
        Ok(())
    }
    
    /// Clean up old processed notifications (keep only last 100)
    pub async fn cleanup_old_notifications(&mut self) -> Result<(), linera_sdk::views::ViewError> {
        let mut notifications = Vec::new();
        let count = self.cross_chain_notifications.count() as usize;
        
        // Collect unprocessed notifications and recent processed ones
        for i in 0..count {
            if let Some(notification) = self.cross_chain_notifications.get(i).await? {
                if !notification.processed {
                    notifications.push(notification);
                } else if notifications.len() < 100 {
                    // Keep only last 100 processed notifications
                    notifications.push(notification);
                }
            }
        }
        
        // Clear and re-insert notifications
        self.cross_chain_notifications.clear();
        for notification in notifications {
            self.cross_chain_notifications.push(notification);
        }
        
        Ok(())
    }
    
    /// Get statistics about cross-chain notifications
    pub async fn get_notification_stats(&self) -> Result<(usize, usize), linera_sdk::views::ViewError> {
        let total_count = self.cross_chain_notifications.count() as usize;
        let mut processed_count = 0;
        
        for i in 0..total_count {
            if let Some(notification) = self.cross_chain_notifications.get(i).await? {
                if notification.processed {
                    processed_count += 1;
                }
            }
        }
        
        let unprocessed_count = total_count - processed_count;
        Ok((unprocessed_count, processed_count))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use linera_sdk::views::ViewStorageContext;
    use tokio;

    #[tokio::test]
    async fn test_state_initialization() {
        let storage = ViewStorageContext::default();
        let mut state = PixelChainState::load(storage).await.unwrap();
        
        state.initialize(100, 50).unwrap();
        
        assert_eq!(*state.canvas_width.get(), 100);
        assert_eq!(*state.canvas_height.get(), 50);
        assert_eq!(*state.colored_pixel_count.get(), 0);
        
        let stats = state.canvas_stats.get();
        assert_eq!(stats.total_pixels, 5000); // 100 * 50
        assert_eq!(stats.colored_pixels, 0);
        assert_eq!(stats.transparent_pixels, 5000);
    }

    #[test]
    fn test_valid_position() {
        let storage = ViewStorageContext::default();
        let state = PixelChainState::load(storage).await.unwrap();
        
        // Set canvas size (would normally be done in initialization)
        // Note: In actual usage, this would be done via initialize()
        
        assert!(state.is_valid_position(0, 0));
        assert!(state.is_valid_position(99, 49));
        assert!(!state.is_valid_position(100, 50));
        assert!(!state.is_valid_position(200, 100));
    }
}