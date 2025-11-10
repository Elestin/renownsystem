# Renown System - Foundry VTT Module

A comprehensive faction and city renown tracking system for Foundry Virtual Tabletop.

## Features

- **Faction & City Management**: Define custom factions and cities with unique bonuses/penalties
- **Relationship System**: Set up friends and enemies between factions
- **Theme Customization**: Customize colors, fonts, and styling
- **Bonus Suggestions**: AI-powered suggestions based on faction descriptors
- **Export/Import**: Save and share world configurations
- **Real-time Updates**: Changes sync across all connected players

## Installation

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Enter the manifest URL: `https://github.com/yourusername/renown-system/releases/latest/download/module.json`
4. Enable the module in your world

## Usage

### For Game Masters

1. **Configure World**: Go to **Settings** → **Module Settings** → **Renown System** → **Configure World**
   - Set up factions, cities, and relationships
   - Customize theme and styling
   - Use bonus suggestions to speed up creation

2. **Track Renown**: Click the Renown Tracker button in the scene controls
   - Update base renown and party actions
   - View cross-faction modifiers
   - See total renown and levels

3. **Export/Import**: 
   - Export your world configuration to share with others
   - Import configurations from other campaigns

### For Players

- View renown tracker (read-only if GM allows)
- See current renown levels with all factions/cities

## Module Structure

```
renown-system/
├── module.json              # Module manifest
├── renown-system.js         # Main module file
├── templates/               # Handlebars templates
│   ├── renown-tracker.html
│   └── admin-config.html
├── styles/                  # CSS files
│   └── renown-system.css
└── lang/                    # Localization
    └── en.json
```

## Development

### Key Differences from Standalone Version

1. **Storage**: Uses `game.settings` instead of `localStorage`
2. **Templates**: Uses Handlebars instead of inline HTML
3. **UI**: Uses Foundry's `Application` and `FormApplication` classes
4. **Permissions**: GM-only configuration, optional player viewing
5. **Sync**: Data automatically syncs to all connected players

### Converting Your Code

1. Replace `localStorage` with `game.settings.set/get`
2. Convert HTML to Handlebars templates
3. Wrap functionality in Foundry Application classes
4. Use Foundry's event system instead of direct DOM manipulation
5. Add proper permissions and socket events for multiplayer

## License

[Your License Here]

## Support

For issues, feature requests, or questions, please visit:
https://github.com/yourusername/renown-system

