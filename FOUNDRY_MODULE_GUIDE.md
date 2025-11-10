# Converting Renown System to Foundry VTT Module

This guide will help you convert your renown tracking system into a Foundry VTT module.

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
├── lang/                    # Localization (optional)
│   └── en.json
└── README.md
```

## Key Changes Needed

### 1. Replace localStorage with Foundry's Storage
- Use `game.settings.set()` and `game.settings.get()` instead of `localStorage`
- Store data in world settings or flags

### 2. Convert HTML to Handlebars Templates
- Foundry uses Handlebars for templating
- Use `FormApplication` class for dialogs/forms
- Use `Application` class for main windows

### 3. Use Foundry's UI System
- Replace direct DOM manipulation with Foundry's rendering system
- Use Foundry's event handling
- Integrate with Foundry's styling

### 4. Module Registration
- Register hooks for initialization
- Create settings for configuration
- Add menu items for GM access

## Implementation Steps

1. **Create module.json** - Define module metadata
2. **Create main JS file** - Initialize module and register hooks
3. **Convert HTML to Handlebars** - Create templates
4. **Create FormApplication classes** - For admin and tracker windows
5. **Migrate data storage** - Use Foundry settings instead of localStorage
6. **Add permissions** - Ensure only GM can configure

## Benefits of Foundry Integration

- **Persistent Storage**: Data saved with world, not browser
- **Multi-user Support**: GM configures, players can view
- **Integration**: Can hook into other systems (actors, items, etc.)
- **Distribution**: Easy to share via Foundry's module browser
- **Version Control**: Module updates handled by Foundry

