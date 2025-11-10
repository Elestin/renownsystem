# Foundry VTT Module Conversion Checklist

## Phase 1: Setup & Structure

- [ ] Create module directory structure
  - [ ] `module.json` (manifest file)
  - [ ] Main JavaScript file (`renown-system.js`)
  - [ ] `templates/` directory
  - [ ] `styles/` directory
  - [ ] `lang/` directory (optional)

- [ ] Configure `module.json`
  - [ ] Set module ID, title, description
  - [ ] Set compatibility version
  - [ ] List all JavaScript files
  - [ ] List all CSS files
  - [ ] List all template files

## Phase 2: Data Storage Migration

- [ ] Replace `localStorage.getItem()` with `game.settings.get()`
- [ ] Replace `localStorage.setItem()` with `game.settings.set()`
- [ ] Register settings in `Hooks.once('init')`
  - [ ] `worldData` setting (scope: 'world')
  - [ ] `renownData` setting (scope: 'world')
- [ ] Test data persistence across sessions

## Phase 3: UI Conversion

- [ ] Convert `index.html` to Handlebars template
  - [ ] Create `templates/renown-tracker.html`
  - [ ] Replace inline JavaScript with Handlebars helpers
  - [ ] Use Foundry's CSS variables for theming

- [ ] Convert `admin.html` to Handlebars template
  - [ ] Create `templates/admin-config.html`
  - [ ] Convert form inputs to Handlebars syntax

- [ ] Create Application classes
  - [ ] `RenownTracker` extends `Application`
  - [ ] `RenownAdminConfig` extends `FormApplication`
  - [ ] Implement `getData()` methods
  - [ ] Implement `activateListeners()` methods

## Phase 4: Functionality Migration

- [ ] Move all JavaScript functions into Application classes
- [ ] Replace direct DOM manipulation with Foundry's rendering
- [ ] Convert event handlers to use jQuery (Foundry's standard)
- [ ] Replace `alert()` with `ui.notifications`
- [ ] Replace `prompt()` with `Dialog.confirm()` or `Dialog.prompt()`

## Phase 5: Styling

- [ ] Convert CSS to use Foundry CSS variables
  - [ ] `--color-text` for text colors
  - [ ] `--color-bg` for backgrounds
  - [ ] `--color-border-light` for borders
- [ ] Ensure styles work within Foundry's UI framework
- [ ] Test dark/light theme compatibility

## Phase 6: Multiplayer Support

- [ ] Add socket events for real-time updates
  - [ ] Broadcast renown changes to all players
  - [ ] Handle permission checks (GM-only config)
- [ ] Test with multiple connected clients

## Phase 7: Integration & Polish

- [ ] Add menu items/buttons
  - [ ] Scene control button for tracker
  - [ ] Settings menu for admin config
- [ ] Add localization support (optional)
- [ ] Add module settings for configuration
- [ ] Test export/import functionality
- [ ] Test with different Foundry versions

## Phase 8: Testing

- [ ] Test module installation
- [ ] Test data persistence
- [ ] Test all CRUD operations
- [ ] Test export/import
- [ ] Test import with invalid data (error handling)
- [ ] Test with multiple users
- [ ] Test permission system

## Phase 9: Documentation & Distribution

- [ ] Write README.md
- [ ] Document all features
- [ ] Create installation instructions
- [ ] Set up GitHub repository
- [ ] Create release with manifest URL
- [ ] Test installation from manifest URL

## Key Code Conversions

### localStorage → game.settings
```javascript
// OLD
localStorage.setItem("worldData", JSON.stringify(data));
const data = JSON.parse(localStorage.getItem("worldData"));

// NEW
await game.settings.set('renown-system', 'worldData', data);
const data = game.settings.get('renown-system', 'worldData');
```

### HTML → Handlebars
```html
<!-- OLD -->
<input value="${faction.baseRenown}" onchange="updateBaseRenown(...)">

<!-- NEW -->
<input type="number" value="{{this.baseRenown}}" data-faction="{{@key}}">
```

### Direct DOM → Application Class
```javascript
// OLD
document.getElementById("renownTable").innerHTML = row;

// NEW
class RenownTracker extends Application {
  activateListeners(html) {
    html.find('.update-base-renown').on('change', (event) => {
      // Handle update
    });
  }
}
```

### Alerts → Notifications
```javascript
// OLD
alert("Data saved!");

// NEW
ui.notifications.info("Data saved!");
```

## Common Pitfalls to Avoid

1. **Don't use `localStorage`** - Use `game.settings` instead
2. **Don't manipulate DOM directly** - Use Foundry's rendering system
3. **Don't use inline event handlers** - Use `activateListeners()`
4. **Don't forget permissions** - Check `game.user.isGM` for admin features
5. **Don't hardcode paths** - Use `modules/renown-system/` prefix
6. **Don't forget async/await** - `game.settings.set()` is async

## Resources

- [Foundry VTT API Documentation](https://foundryvtt.com/api/)
- [Foundry Module Development Tutorial](https://foundryvtt.com/article/module-development/)
- [Foundry Community Discord](https://discord.gg/foundryvtt)
- [Foundry Module Examples](https://github.com/foundryvtt/foundryvtt)

