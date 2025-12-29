# Pixel Chain - A Collaborative Canvas Application

Pixel Chain is a decentralized collaborative drawing application built on the Linera blockchain. It allows multiple users to paint pixels on a shared canvas in real-time, creating collaborative art pieces that are permanently stored on the blockchain.

## Features

### Core Functionality
- **Shared Canvas**: A collaborative drawing surface where users can paint pixels
- **Real-time Updates**: Pixel changes are immediately visible to all participants
- **Color Support**: Full RGB color space with alpha channel for transparency
- **Batch Operations**: Set multiple pixels at once for efficient drawing
- **Canvas Bounds**: Configurable canvas dimensions
- **Ownership Tracking**: Each pixel records who painted it and when
- **History Logging**: Complete history of all pixel changes

### Technical Features
- **Decentralized**: All data stored on the Linera blockchain
- **Event System**: Real-time pixel change notifications
- **Statistics**: Canvas usage analytics (colored pixels, unique colors, etc.)
- **GraphQL API**: Full query interface for reading canvas state
- **Cross-chain Support**: Support for multi-chain deployments

## How It Works

Pixel Chain operates on the principle of collaborative creation where multiple users can simultaneously modify a shared canvas. Each pixel change is:

1. **Validated**: Coordinates are checked to ensure they're within canvas bounds
2. **Stored**: Pixel data including color, owner, and timestamp is saved
3. **Logged**: All changes are recorded for history and analytics
4. **Broadcast**: Pixel change events are emitted for real-time updates

### Data Structure

```
Canvas
├── Dimensions (width × height)
├── Pixels (position → Pixel data)
│   ├── Color (RGBA)
│   ├── Owner (Chain ID)
│   └── Timestamp
├── Update History
└── Statistics
    ├── Total pixels
    ├── Colored pixels
    ├── Transparent pixels
    └── Unique colors
```

## Setup and Deployment

Before getting started, ensure that the binary tools `linera*` corresponding to your version of `linera-sdk` are in your PATH. For scripting purposes, we also assume that the BASH function `linera_spawn` is defined.

### 1. Environment Setup

From the root of Linera repository:

```bash
export PATH="$PWD/target/debug:$PATH"
eval "$(linera net helper 2>/dev/null)"
```

### 2. Start Local Network

Start the local Linera network and run a faucet:

```bash
LINERA_FAUCET_PORT=8079
LINERA_FAUCET_URL=http://localhost:$LINERA_FAUCET_PORT
linera_spawn linera net up --with-faucet --faucet-port $LINERA_FAUCET_PORT
```

### 3. Create Wallet and Chain

```bash
export LINERA_WALLET="$LINERA_TMP_DIR/wallet.json"
export LINERA_KEYSTORE="$LINERA_TMP_DIR/keystore.json"
export LINERA_STORAGE="rocksdb:$LINERA_TMP_DIR/client.db"

linera wallet init --faucet $LINERA_FAUCET_URL

INFO=($(linera wallet request-chain --faucet $LINERA_FAUCET_URL))
CHAIN="${INFO[0]}"
OWNER="${INFO[1]}"
```

### 4. Compile and Deploy

Compile the Pixel Chain application and create an application instance:

```bash
cd examples/pixel-chain
cargo build --release --target wasm32-unknown-unknown

LINERA_APPLICATION_ID=$(linera publish-and-create \
  ../target/wasm32-unknown-unknown/release/pixel_chain_{contract,service}.wasm \
  --json-argument '{"width": 100, "height": 100}')
```

**Note**: Replace `100` and `100` with your desired canvas dimensions.

### 5. Start GraphQL Service

Start the service to access the GraphQL interface:

```bash
PORT=8080
linera service --port $PORT &
echo "http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID"
```

## API Usage

### GraphQL Queries

#### Get Canvas Dimensions
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
query {
  canvasDimensions {
    x
    y
    width
    height
  }
}
```

#### Get a Specific Pixel
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
query {
  pixel(x: 50, y: 25) {
    x
    y
    color {
      red
      green
      blue
      alpha
    }
    owner
    timestamp
  }
}
```

#### Get Pixels in an Area
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
query {
  pixelsInArea(bounds: { x: 0, y: 0, width: 10, height: 10 }) {
    x
    y
    color {
      red
      green
      blue
      alpha
    }
  }
}
```

#### Get Canvas Statistics
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
query {
  canvasStats {
    totalPixels
    coloredPixels
    transparentPixels
    uniqueColors
    lastUpdate
  }
}
```

#### Get Recent Updates
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
query {
  recentUpdates(limit: 10) {
    x
    y
    color {
      red
      green
      blue
      alpha
    }
  }
}
```

### GraphQL Mutations

#### Set a Single Pixel
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
mutation {
  setPixel(
    x: 50
    y: 25
    color: { red: 255, green: 0, blue: 0, alpha: 255 }
  )
}
```

#### Clear a Pixel
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
mutation {
  clearPixel(x: 50, y: 25)
}
```

#### Set Multiple Pixels (Batch Operation)
```gql,uri=http://localhost:8080/chains/$CHAIN/applications/$LINERA_APPLICATION_ID
mutation {
  setPixels(pixels: [
    { x: 0, y: 0, color: { red: 255, green: 0, blue: 0, alpha: 255 } }
    { x: 1, y: 0, color: { red: 0, green: 255, blue: 0, alpha: 255 } }
    { x: 2, y: 0, color: { red: 0, green: 0, blue: 255, alpha: 255 } }
  ])
}
```

## Example Usage Scenarios

### Creating a Simple Drawing
1. **Set background color** by clearing pixels or setting them to a base color
2. **Draw shapes** using batch pixel operations
3. **Add details** with individual pixel placements
4. **Monitor progress** using the statistics query

### Collaborative Drawing
1. **Multiple users** can connect to the same application
2. **Real-time updates** appear automatically as users paint
3. **Ownership tracking** shows who painted each pixel
4. **History logging** maintains a complete record of changes

### Canvas Analytics
- Monitor **canvas utilization** through statistics
- Track **color diversity** with unique colors query
- Analyze **user activity** through update history
- **Performance monitoring** via pixel count metrics

## Technical Details

### Contract Operations
- `SetPixel`: Set a single pixel to a specific color
- `ClearPixel`: Clear a pixel (set to transparent)
- `SetPixels`: Batch operation for setting multiple pixels

### State Management
- **Canvas dimensions**: Stored as registers for quick access
- **Pixel data**: Custom map for efficient lookups by position
- **Update history**: Log view for tracking all changes
- **Statistics**: Automatically updated counters

### Events
- `PixelChanged`: Emitted when a pixel is set to a new color
- `PixelCleared`: Emitted when a pixel is cleared
- `BatchUpdate`: Emitted for batch pixel operations

## Development

### Building
```bash
cargo build --release --target wasm32-unknown-unknown
```

### Testing
```bash
cargo test
```

### Code Structure
```
pixel-chain/
├── src/
│   ├── lib.rs          # ABI definitions and types
│   ├── state.rs        # Application state management
│   ├── contract.rs     # Contract logic and operations
│   └── service.rs      # GraphQL service and queries
├── Cargo.toml
└── README.md
```

## Contributing

This is an example application demonstrating Linera's capabilities for collaborative applications. Feel free to extend it with features like:

- **User permissions**: Control who can paint on the canvas
- **Canvas tools**: Add drawing tools like lines, circles, and brushes
- **Image imports**: Support for uploading and converting images
- **Auction system**: Allow users to bid on prime canvas positions
- **NFT creation**: Turn completed artworks into NFTs

## License

This example is part of the Linera protocol and follows the same licensing terms.