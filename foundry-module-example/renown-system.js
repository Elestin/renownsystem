/**
 * Renown System Module for Foundry VTT
 * Main module file
 */

Hooks.once('init', () => {
  console.log('Renown System | Initializing...');
  
  // Register module settings
  game.settings.register('renown-system', 'worldData', {
    name: 'World Configuration',
    hint: 'Stores faction, city, and relationship data',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  game.settings.register('renown-system', 'renownData', {
    name: 'Renown Data',
    hint: 'Stores current renown values',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  // Register module settings menu
  game.settings.registerMenu('renown-system', 'adminConfig', {
    name: 'Configure World',
    label: 'Open Admin Panel',
    hint: 'Configure factions, cities, relationships, and themes',
    icon: 'fas fa-cog',
    type: RenownAdminConfig,
    restricted: true
  });
});

Hooks.once('ready', () => {
  console.log('Renown System | Ready!');
  
  // Add menu item for GM
  if (game.user.isGM) {
    // Add to game settings menu (already done via registerMenu)
    // Or add to scene controls, etc.
  }
});

/**
 * Main Renown Tracker Application
 */
class RenownTracker extends Application {
  constructor(options = {}) {
    super(options);
    this.worldData = null;
    this.factions = [];
    this.relationshipTable = {};
    this.savedData = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'renown-tracker',
      title: 'Renown Tracker',
      template: 'modules/renown-system/templates/renown-tracker.html',
      width: 900,
      height: 700,
      resizable: true,
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'tracker' }]
    });
  }

  getData() {
    this.loadWorldData();
    return {
      worldName: this.worldData?.worldName || 'Default World',
      factions: this.factions,
      savedData: this.savedData,
      theme: this.worldData?.theme || {}
    };
  }

  loadWorldData() {
    this.worldData = game.settings.get('renown-system', 'worldData');
    if (!this.worldData) {
      this.worldData = this.getDefaultWorldData();
      game.settings.set('renown-system', 'worldData', this.worldData);
    }
    
    this.factions = this.worldData.factions || [];
    this.relationshipTable = this.worldData.relationships || {};
    
    // Load renown data
    this.savedData = game.settings.get('renown-system', 'renownData') || {};
    this.initializeRenownData();
  }

  initializeRenownData() {
    // Initialize missing factions
    this.factions.forEach(faction => {
      if (!this.savedData[faction.name]) {
        this.savedData[faction.name] = {
          baseRenown: 0,
          partyActions: 0,
          crossFactionModifiers: 0,
          totalRenown: 0
        };
      }
    });
    
    // Remove factions that no longer exist
    Object.keys(this.savedData).forEach(name => {
      if (!this.factions.find(f => f.name === name)) {
        delete this.savedData[name];
      }
    });
    
    this.calculateRenown();
    this.saveRenownData();
  }

  calculateRenown() {
    Object.keys(this.savedData).forEach(name => {
      const data = this.savedData[name];
      data.totalRenown = data.baseRenown + data.partyActions + data.crossFactionModifiers;
    });
  }

  saveRenownData() {
    game.settings.set('renown-system', 'renownData', this.savedData);
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Update base renown
    html.find('.update-base-renown').on('change', (event) => {
      const name = $(event.currentTarget).data('faction');
      const value = parseInt($(event.currentTarget).val()) || 0;
      this.updateBaseRenown(name, value);
    });

    // Update party actions
    html.find('.update-party-actions').on('change', (event) => {
      const name = $(event.currentTarget).data('faction');
      const value = parseInt($(event.currentTarget).val()) || 0;
      this.updatePartyActions(name, value);
    });

    // Reset button
    html.find('.reset-renown').on('click', () => {
      this.resetRenown();
    });

    // Export/Import buttons
    html.find('.export-renown').on('click', () => this.exportRenownData());
    html.find('.import-renown').on('click', () => this.importRenownData());
    html.find('.export-world').on('click', () => this.exportFullWorld());
    html.find('.import-world').on('click', () => this.importFullWorld());

    // Tooltip hover
    html.find('.faction-name').on('mouseenter', (event) => {
      this.showTooltip(event, $(event.currentTarget).data('faction'));
    });
    html.find('.faction-name').on('mouseleave', () => {
      this.hideTooltip();
    });
  }

  updateBaseRenown(name, value) {
    const data = this.savedData[name];
    if (!data) return;
    
    const oldRenown = data.baseRenown;
    data.baseRenown = value;
    const delta = value - oldRenown;
    
    this.adjustRelatedRenown(name, delta);
    this.calculateRenown();
    this.saveRenownData();
    this.render();
  }

  updatePartyActions(name, value) {
    const data = this.savedData[name];
    if (!data) return;
    
    const oldRenown = data.partyActions;
    data.partyActions = value;
    const delta = value - oldRenown;
    
    this.adjustRelatedRenown(name, delta);
    this.calculateRenown();
    this.saveRenownData();
    this.render();
  }

  adjustRelatedRenown(name, delta) {
    const relationships = this.relationshipTable[name];
    if (!relationships) return;

    relationships.enemies?.forEach(enemyName => {
      if (this.savedData[enemyName]) {
        this.savedData[enemyName].crossFactionModifiers -= delta * 0.5;
      }
    });

    relationships.friends?.forEach(friendName => {
      if (this.savedData[friendName]) {
        this.savedData[friendName].crossFactionModifiers += delta * 0.3;
      }
    });
  }

  resetRenown() {
    Dialog.confirm({
      title: 'Reset Renown',
      content: '<p>Type DELETE to confirm renown reset:</p><input type="text" id="reset-confirm">',
      yes: () => {
        const input = document.getElementById('reset-confirm');
        if (input && input.value === 'DELETE') {
          Object.keys(this.savedData).forEach(name => {
            this.savedData[name] = {
              baseRenown: 0,
              partyActions: 0,
              crossFactionModifiers: 0,
              totalRenown: 0
            };
          });
          this.saveRenownData();
          this.render();
          ui.notifications.info('Renown has been reset.');
        } else {
          ui.notifications.warn('Renown reset canceled.');
        }
      },
      no: () => {}
    });
  }

  exportRenownData() {
    const dataStr = JSON.stringify(this.savedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'renown_data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importRenownData() {
    // Use Foundry's file picker or create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (this.validateRenownData(imported)) {
            this.savedData = imported;
            this.saveRenownData();
            this.render();
            ui.notifications.info('Renown data imported successfully!');
          } else {
            ui.notifications.error('Invalid renown data format.');
          }
        } catch (error) {
          ui.notifications.error('Failed to import: ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  exportFullWorld() {
    const exportData = {
      ...this.worldData,
      savedRenownData: this.savedData
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.worldData.worldName.replace(/[^a-z0-9]/gi, '_')}_complete.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importFullWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.factions && imported.theme && imported.relationships) {
            this.worldData = imported;
            game.settings.set('renown-system', 'worldData', this.worldData);
            
            if (imported.savedRenownData) {
              this.savedData = imported.savedRenownData;
              this.saveRenownData();
            }
            
            this.loadWorldData();
            this.render();
            ui.notifications.info('Full world imported successfully!');
          } else {
            ui.notifications.error('Invalid world file format.');
          }
        } catch (error) {
          ui.notifications.error('Failed to import: ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  validateRenownData(data) {
    return typeof data === 'object' && data !== null;
  }

  showTooltip(event, factionName) {
    const faction = this.factions.find(f => f.name === factionName);
    if (!faction) return;
    
    const data = this.savedData[factionName];
    const totalRenown = data?.totalRenown || 0;
    const bonuses = faction.bonuses || {};
    const closestLevel = Object.keys(bonuses).reduce((prev, curr) => 
      Math.abs(parseInt(curr) - totalRenown) < Math.abs(parseInt(prev) - totalRenown) ? curr : prev
    );
    
    // Create tooltip (you'd use a proper tooltip library or Foundry's tooltip system)
    // This is simplified
  }

  hideTooltip() {
    // Hide tooltip
  }

  getDefaultWorldData() {
    // Return your default world data structure
    return {
      worldName: "Default World",
      theme: {
        fontFamily: "'IM Fell English SC', serif",
        bgColor1: "#2e1a14",
        bgColor2: "#4a3326",
        textColor: "#f8e8c0",
        headingColor: "#ffdd8b",
        tableBg: "rgba(255, 248, 228, 0.9)",
        tableBorder: "#523c23",
        positiveColor1: "#2e8b57",
        positiveColor2: "#66cdaa",
        neutralColor1: "#4682b4",
        neutralColor2: "#87cefa",
        negativeColor1: "#b22222",
        negativeColor2: "#dc143c"
      },
      factions: [],
      relationships: {}
    };
  }
}

/**
 * Admin Configuration Application
 */
class RenownAdminConfig extends FormApplication {
  constructor(options = {}) {
    super(options);
    this.worldData = null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'renown-admin-config',
      title: 'Renown System - World Configuration',
      template: 'modules/renown-system/templates/admin-config.html',
      width: 1000,
      height: 800,
      resizable: true,
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'world' }]
    });
  }

  getData() {
    this.worldData = game.settings.get('renown-system', 'worldData') || this.getDefaultWorldData();
    return {
      worldData: this.worldData,
      factions: this.worldData.factions || [],
      relationships: this.worldData.relationships || {}
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Add all your admin panel event listeners here
    // Similar to your current admin.html JavaScript
    
    html.find('.save-world').on('click', () => this.saveWorld());
    html.find('.export-world').on('click', () => this.exportWorld());
    html.find('.import-world').on('click', () => this.importWorld());
    html.find('.add-faction').on('click', () => this.addFaction());
    // ... etc
  }

  async _updateObject(event, formData) {
    // Handle form submission
    this.worldData = foundry.utils.mergeObject(this.worldData, formData);
    await game.settings.set('renown-system', 'worldData', this.worldData);
    this.render();
  }

  saveWorld() {
    // Collect all form data and save
    const formData = this._getSubmitData();
    this.worldData = foundry.utils.mergeObject(this.worldData, formData);
    game.settings.set('renown-system', 'worldData', this.worldData);
    ui.notifications.info('World configuration saved!');
  }

  exportWorld() {
    // Similar to your current export function
  }

  importWorld() {
    // Similar to your current import function
  }

  getDefaultWorldData() {
    // Return default world data
    return {
      worldName: "Default World",
      theme: { /* ... */ },
      factions: [],
      relationships: {}
    };
  }
}

// Register the tracker application
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;
  
  const trackerButton = {
    name: 'renown',
    title: 'Renown Tracker',
    icon: 'fas fa-star',
    layer: 'renown',
    tools: [
      {
        name: 'tracker',
        title: 'Open Renown Tracker',
        icon: 'fas fa-star',
        onClick: () => {
          new RenownTracker().render(true);
        },
        button: true
      }
    ]
  };
  
  controls.push(trackerButton);
});

