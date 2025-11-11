# Foundry VTT Module Conversion Guide

This guide will help you complete the conversion of your Renown System from standalone HTML/JS to a Foundry VTT module.

## Quick Start: What You Need to Do

### Step 1: Complete the Module Structure

Your module should be in the `foundry-module-example` directory. The structure should be:

```
foundry-module-example/
├── module.json              ✅ Already exists
├── renown-system.js         ⚠️ Needs completion
├── README.md                ✅ Already exists
├── templates/
│   ├── renown-tracker.html  ⚠️ Needs fixes
│   └── admin-config.html    ❌ Needs creation
├── styles/
│   └── renown-system.css   ⚠️ Needs completion
└── lang/
    └── en.json              ❌ Optional but recommended
```

### Step 2: Key Conversion Tasks

#### A. Fix the Template Data Structure

The `renown-tracker.html` template expects `savedData` to be an object, but your code uses it as an object (which is correct). However, Handlebars needs the data formatted properly.

**Current issue**: The template uses `{{#each savedData}}` but `savedData` is an object, not an array.

**Solution**: In `getData()`, convert the object to an array format for the template:

```javascript
getData() {
  this.loadWorldData();
  
  // Convert savedData object to array for template
  const savedDataArray = Object.keys(this.savedData).map(name => ({
    name: name,
    ...this.savedData[name]
  }));
  
  return {
    worldName: this.worldData?.worldName || 'Default World',
    factions: this.factions,
    savedData: savedDataArray,  // Now it's an array
    savedDataObj: this.savedData, // Keep object version for logic
    theme: this.worldData?.theme || {}
  };
}
```

#### B. Create admin-config.html Template

This is the biggest missing piece. You need to convert your `admin.html` into a Handlebars template. The template should include:
- Tabs for World/Theme, Factions, Relationships
- Form inputs for all configuration options
- Dynamic faction/relationship lists
- Relationship graph button

#### C. Complete RenownAdminConfig Class

The `RenownAdminConfig` class needs all the functionality from `admin.html`:
- Faction management (add, remove, edit)
- Relationship management
- Theme customization
- Bonus suggestions
- Relationship graph visualization
- Export/Import functionality

#### D. Add Socket Events for Multiplayer

Add socket events so changes sync to all players:

```javascript
// In Hooks.once('init')
game.socket.on('module.renown-system', (data) => {
  if (data.type === 'renownUpdate') {
    // Update renown data
    game.settings.set('renown-system', 'renownData', data.renownData);
    // Refresh any open trackers
    Object.values(ui.windows).forEach(app => {
      if (app instanceof RenownTracker) {
        app.render();
      }
    });
  }
});

// When updating renown, broadcast it
updateBaseRenown(name, value) {
  // ... existing code ...
  if (game.user.isGM) {
    game.socket.emit('module.renown-system', {
      type: 'renownUpdate',
      renownData: this.savedData
    });
  }
}
```

#### E. Add Relationship Graph to Foundry

The relationship graph needs to be integrated into the Foundry module. You'll need to:
1. Include vis.js library (add to module.json or load dynamically)
2. Add graph button to admin config
3. Create graph modal in admin template
4. Port the graph creation code

### Step 3: Testing Checklist

- [ ] Module loads without errors
- [ ] Settings menu appears for GM
- [ ] Renown Tracker opens from scene controls
- [ ] Admin config opens from settings
- [ ] Can add/edit/remove factions
- [ ] Can set relationships
- [ ] Can customize theme
- [ ] Renown updates work
- [ ] Cross-faction modifiers calculate correctly
- [ ] Export/Import works
- [ ] Relationship graph displays
- [ ] Changes sync to other players (multiplayer test)

### Step 4: Installation Instructions

Once complete, users install via:

1. Copy `foundry-module-example` folder to `Data/modules/renown-system/` in Foundry
2. Or use manifest URL (once you have a GitHub release)

## Common Issues & Solutions

### Issue: Template not rendering data
**Solution**: Check that `getData()` returns the correct format. Use `console.log()` to debug.

### Issue: Styles not applying
**Solution**: Make sure CSS uses Foundry CSS variables. Check that `module.json` lists the CSS file.

### Issue: Settings not persisting
**Solution**: Ensure you're using `await game.settings.set()` (it's async) and the scope is 'world'.

### Issue: Socket events not working
**Solution**: Make sure `"socket": true` is in `module.json` and you're using `game.socket.emit()` correctly.

## Next Steps

1. **Complete admin-config.html template** - This is the biggest task
2. **Add all admin functionality** to RenownAdminConfig class
3. **Add relationship graph** functionality
4. **Add socket events** for multiplayer
5. **Test thoroughly** with multiple users
6. **Create GitHub release** with manifest URL

## Resources

- [Foundry VTT API Docs](https://foundryvtt.com/api/)
- [Foundry Module Development](https://foundryvtt.com/article/module-development/)
- [Handlebars Helpers](https://handlebarsjs.com/guide/expressions.html)

