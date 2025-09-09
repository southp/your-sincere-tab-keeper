# Your Sincere Tab Keeper

A Chrome extension that limits open tabs to a user-defined cap. When the user exceeds this limit, the new tab is replaced with a maze. The user must solve the maze to load the intended URL. The goal is to help users reflect on why they hoard tabs and encourage mindful tab usage through playful friction, forming better habits in a fun but firm way.

## Development Quick Start

### Load from the source
Since this extension is built with just vanilla JavaScript, you can simply load it as the unpacked extension with Chrome Developer Mode enabled.
When loaded this way, debugging logs and several debug utilities will be available in the web page console and the background service worker console.

### Build the production version
```bash
npm install
npm run build
```
By doing so, the production version will be available in the `dist` directory. 

The packed zip for submitting to the chrome store is created by running `npm run pack`.

Please refer to [the development doc](docs/development.md) for further details.

## License

MIT License - see [LICENSE](LICENSE) for details.
