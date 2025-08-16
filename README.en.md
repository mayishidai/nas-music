# NAS Music Server Lyrics Plugin System

## Project Introduction
This is a lyrics search plugin system developed for NAS music servers, supporting lyrics information retrieval through APIs of multiple music platforms. The system includes the following core functions:

- Support for lyrics search services across multiple music platforms
- Smart matching algorithm to select the best lyrics results
- Plugin-based architecture for easy expansion
- Lyrics format cleaning and standardization

Currently supported platforms:
- NetEase Cloud Music
- Migu Music
- Kugou Music
- QQ Music

## Key Features
1. **Multi-platform Support**: Achieves lyrics search across multiple music platforms through different plugins
2. **Smart Matching**: Automatically selects the most matching lyrics using string similarity algorithms
3. **Format Standardization**: Unifies lyrics formats from different platforms and removes unnecessary blank lines
4. **Plugin Management**: Plugins can be dynamically registered/unregistered
5. **Error Handling**: Comprehensive error logging and exception handling mechanisms

## Installation Guide
1. Ensure Node.js and npm are installed
2. Clone the repository:
   ```bash
   git clone https://gitee.com/yanfanVIP/nas-music.git
   ```
3. Install dependencies:
   ```bash
   cd nas-music
   npm install
   ```
4. Configure API keys (if required):
   ```bash
   # Configure relevant API keys in the apikey file
   ```

## Usage
1. Initialize the plugin manager:
   ```javascript
   const lyricsPluginManager = new LyricsPluginManager();
   ```

2. Search for lyrics:
   ```javascript
   // Search using all plugins
   const results = await lyricsPluginManager.searchLyrics("Song Name", "Artist");
   
   // Search using a specific plugin
   const result = await lyricsPluginManager.searchLyrics("Song Name", "Artist", "netease");
   ```

3. Get plugin information:
   ```javascript
   const pluginInfo = lyricsPluginManager.getPluginInfo("migu");
   ```

## Plugin Development
To add a new lyrics plugin, simply:
1. Create a new plugin file in the `src/plugins/` directory
2. Implement the `getInfo()` and `searchLyrics()` methods
3. Register the plugin in the `LyricsPluginManager`

## Technical Architecture
The system adopts a modular design, primarily consisting of:
- Plugin Interface Layer: Defines standard plugin interfaces
- Network Request Layer: Handles HTTP requests
- Data Processing Layer: Lyrics format cleaning and matching algorithms
- Core Engine: Plugin management and scheduling

## License
This project is licensed under the MIT License. Please see the LICENSE file for details.