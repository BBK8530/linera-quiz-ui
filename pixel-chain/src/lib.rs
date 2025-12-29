// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/*! ABI of the Pixel Chain Example Application */

use async_graphql::{InputObject, Request, Response, SimpleObject};
use std::hash::Hash;
use linera_sdk::{
    bcs,
    linera_base_types::{ChainId, ContractAbi, ServiceAbi, Timestamp},
    views::{ViewError, CustomSerialize},
};
use serde::{Deserialize, Serialize};

pub struct PixelChainAbi;

impl ContractAbi for PixelChainAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for PixelChainAbi {
    type Query = Request;
    type QueryResponse = Response;
}

/// An operation that can be executed by the application.
#[derive(Debug, Serialize, Deserialize)]
pub enum Operation {
    /// Set a pixel at the specified coordinates with a color
    SetPixel {
        x: u32,
        y: u32,
        color: PixelColor,
    },
    /// Clear a pixel (set it back to default/transparent)
    ClearPixel {
        x: u32,
        y: u32,
    },
    /// Set multiple pixels at once (batch operation)
    SetPixels {
        pixels: Vec<PixelUpdate>,
    },
}

/// A pixel color represented as RGB values
#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize, SimpleObject, InputObject, Default)]
#[graphql(input_name = "PixelColorInput")]
pub struct PixelColor {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}

impl Hash for PixelColor {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.red.hash(state);
        self.green.hash(state);
        self.blue.hash(state);
        self.alpha.hash(state);
    }
}

impl PixelColor {
    pub fn new(red: u8, green: u8, blue: u8, alpha: u8) -> Self {
        Self {
            red,
            green,
            blue,
            alpha,
        }
    }

    pub fn is_transparent(&self) -> bool {
        self.alpha == 0
    }

    pub fn to_hex(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.red, self.green, self.blue)
    }
}

/// A pixel update operation
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "PixelUpdateInput")]
pub struct PixelUpdate {
    pub x: u32,
    pub y: u32,
    pub color: PixelColor,
}

/// A single pixel on the canvas
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject)]
pub struct Pixel {
    pub x: u32,
    pub y: u32,
    pub color: Option<PixelColor>,
    pub owner: Option<ChainId>,
    pub timestamp: Timestamp,
}

/// Position on the canvas
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "PositionInput")]
pub struct Position {
    pub x: u32,
    pub y: u32,
}

impl CustomSerialize for Position {
    fn to_custom_bytes(&self) -> Result<Vec<u8>, ViewError> {
        let data = (self.x.to_be_bytes(), self.y.to_be_bytes());
        Ok(bcs::to_bytes(&data)?)
    }

    fn from_custom_bytes(bytes: &[u8]) -> Result<Self, ViewError> {
        let (x_bytes, y_bytes) = bcs::from_bytes(bytes)?;
        Ok(Self {
            x: u32::from_be_bytes(x_bytes),
            y: u32::from_be_bytes(y_bytes),
        })
    }
}

/// A rectangle area on the canvas
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "CanvasBoundsInput")]
pub struct CanvasBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Statistics about the pixel canvas
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject, Default)]
pub struct CanvasStats {
    pub total_pixels: u32,
    pub colored_pixels: u32,
    pub transparent_pixels: u32,
    pub unique_colors: u32,
    pub last_update: Option<Timestamp>,
}

/// Cross-chain messages for pixel ownership notifications
#[derive(Debug, Serialize, Deserialize)]
pub enum Message {
    /// Notify pixel owner that their pixel was modified by another chain
    PixelModified {
        x: u32,
        y: u32,
        new_color: Option<PixelColor>,
        modified_by: ChainId,
        timestamp: Timestamp,
    },
    /// Notify pixel owner about batch pixel modifications
    BatchPixelModified {
        pixels: Vec<PixelModification>,
        modified_by: ChainId,
        timestamp: Timestamp,
    },
    /// Request to claim or transfer pixel ownership
    OwnershipClaim {
        x: u32,
        y: u32,
        requested_by: ChainId,
        timestamp: Timestamp,
    },
}

/// Information about a single pixel modification
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject)]
pub struct PixelModification {
    pub x: u32,
    pub y: u32,
    pub new_color: Option<PixelColor>,
    pub previous_color: Option<PixelColor>,
}

/// Permission levels for pixel modifications
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize)]
pub enum PixelPermission {
    /// Anyone can modify this pixel
    Public,
    /// Only the owner can modify this pixel
    OwnerOnly,
    /// Whitelist of chain IDs that can modify this pixel
    Restricted(Vec<ChainId>),
}

/// Cross-chain notification record
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject)]
pub struct Notification {
    pub notification_type: String,
    pub x: u32,
    pub y: u32,
    pub new_color: Option<PixelColor>,
    pub modified_by: ChainId,
    pub timestamp: Timestamp,
    pub processed: bool,
}

/// Cross-chain notification statistics
#[derive(Clone, PartialEq, Debug, Serialize, Deserialize, SimpleObject)]
pub struct NotificationStats {
    pub unprocessed_count: usize,
    pub processed_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pixel_color_creation() {
        let color = PixelColor::new(255, 0, 0, 255);
        assert_eq!(color.red, 255);
        assert_eq!(color.green, 0);
        assert_eq!(color.blue, 0);
        assert_eq!(color.alpha, 255);
        assert_eq!(color.to_hex(), "#ff0000");
        assert!(!color.is_transparent());
    }

    #[test]
    fn test_transparent_pixel() {
        let transparent = PixelColor::new(0, 0, 0, 0);
        assert!(transparent.is_transparent());
    }
}