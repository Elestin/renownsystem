/**
 * Renown System Module for Foundry VTT
 * Main module file
 */

// Import the Regional Factions Manager
// Note: In Foundry, we'll load this via module.json

Hooks.once('init', () => {
  console.log('Renown System | Initializing...');
  
  // Register Handlebars helpers
  Handlebars.registerHelper('calculateBarWidth', (value) => {
    return Math.min(Math.max((parseFloat(value) + 100) / 2, 0), 100);
  });
  
  Handlebars.registerHelper('eq', (a, b) => {
    return a === b;
  });
  
  Handlebars.registerHelper('gte', (a, b) => {
    return parseFloat(a) >= parseFloat(b);
  });
  
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

  game.settings.register('renown-system', 'regionalData', {
    name: 'Regional Power Data',
    hint: 'Stores regional faction power dynamics data',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      regions: {},
      factionDetails: {}
    }
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
  
  // Register socket listener for multiplayer sync
  game.socket.on('module.renown-system', (data) => {
    if (data.type === 'renownUpdate' && !game.user.isGM) {
      // Non-GM players receive updates
      game.settings.set('renown-system', 'renownData', data.renownData);
      // Refresh any open trackers
      Object.values(ui.windows).forEach(app => {
        if (app instanceof RenownTracker) {
          app.render();
        }
      });
    } else if (data.type === 'worldUpdate' && !game.user.isGM) {
      // World data updates
      game.settings.set('renown-system', 'worldData', data.worldData);
      Object.values(ui.windows).forEach(app => {
        if (app instanceof RenownTracker || app instanceof RenownAdminConfig) {
          app.render();
        }
      });
    } else if (data.type === 'regionalUpdate' && !game.user.isGM) {
      // Regional data updates
      game.settings.set('renown-system', 'regionalData', data.regionalData);
      Object.values(ui.windows).forEach(app => {
        if (app instanceof RenownAdminConfig) {
          app.render();
        }
      });
    }
  });
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
    // Load world data synchronously for getData (settings are sync)
    this.worldData = game.settings.get('renown-system', 'worldData');
    if (!this.worldData) {
      this.worldData = this.getDefaultWorldData();
      game.settings.set('renown-system', 'worldData', this.worldData);
    }
    
    this.factions = this.worldData.factions || [];
    this.relationshipTable = this.worldData.relationships || {};
    
    // Load renown data - auto-loads from settings
    let loadedData = game.settings.get('renown-system', 'renownData') || {};
    
    // Migrate from array format to object format if needed
    if (Array.isArray(loadedData)) {
      const migratedData = {};
      loadedData.forEach((item, index) => {
        if (item && item.name) {
          migratedData[item.name] = item;
        } else if (this.factions[index]) {
          // Fallback: use faction at same index
          migratedData[this.factions[index].name] = {
            baseRenown: item?.baseRenown || 0,
            partyActions: item?.partyActions || 0,
            crossFactionModifiers: item?.crossFactionModifiers || 0,
            totalRenown: item?.totalRenown || 0
          };
        }
      });
      loadedData = migratedData;
      // Save migrated data
      game.settings.set('renown-system', 'renownData', loadedData);
    }
    
    // Ensure it's an object with faction names as keys
    this.savedData = {};
    this.factions.forEach(faction => {
      if (loadedData[faction.name]) {
        // Use existing data
        this.savedData[faction.name] = {
          baseRenown: parseFloat(loadedData[faction.name].baseRenown) || 0,
          partyActions: parseFloat(loadedData[faction.name].partyActions) || 0,
          crossFactionModifiers: parseFloat(loadedData[faction.name].crossFactionModifiers) || 0,
          totalRenown: parseFloat(loadedData[faction.name].totalRenown) || 0
        };
      } else {
        // Initialize new faction
        this.savedData[faction.name] = {
          baseRenown: 0,
          partyActions: 0,
          crossFactionModifiers: 0,
          totalRenown: 0
        };
      }
    });
    
    // Remove any savedData entries for factions that no longer exist
    Object.keys(loadedData).forEach(name => {
      if (!this.factions.find(f => f.name === name)) {
        delete loadedData[name];
      }
    });
    
    // Calculate renown before rendering
    this.calculateRenown();
    
    // Convert savedData object to array for template (only include existing factions)
    const savedDataArray = this.factions
      .filter(faction => this.savedData[faction.name])
      .map(faction => ({
        name: faction.name,
        baseRenown: this.savedData[faction.name].baseRenown || 0,
        partyActions: this.savedData[faction.name].partyActions || 0,
        crossFactionModifiers: (this.savedData[faction.name].crossFactionModifiers || 0).toFixed(2),
        totalRenown: (this.savedData[faction.name].totalRenown || 0).toFixed(2),
        totalRenownRaw: this.savedData[faction.name].totalRenown || 0
      }));
    
    return {
      worldName: this.worldData?.worldName || 'Default World',
      factions: this.factions,
      savedData: savedDataArray,
      theme: this.worldData?.theme || {}
    };
  }

  async loadWorldData() {
    this.worldData = game.settings.get('renown-system', 'worldData');
    if (!this.worldData) {
      this.worldData = this.getDefaultWorldData();
      await game.settings.set('renown-system', 'worldData', this.worldData);
    }
    
    this.factions = this.worldData.factions || [];
    this.relationshipTable = this.worldData.relationships || {};
    
    // Load renown data - this should auto-load from settings
    this.savedData = game.settings.get('renown-system', 'renownData') || {};
    await this.initializeRenownData();
  }

  async initializeRenownData() {
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
    await this.saveRenownData();
  }

  calculateRenown() {
    Object.keys(this.savedData).forEach(name => {
      const data = this.savedData[name];
      // Ensure all values are numbers
      const base = parseFloat(data.baseRenown) || 0;
      const actions = parseFloat(data.partyActions) || 0;
      const modifiers = parseFloat(data.crossFactionModifiers) || 0;
      data.totalRenown = base + actions + modifiers;
      // Round to 2 decimal places
      data.totalRenown = Math.round(data.totalRenown * 100) / 100;
    });
  }

  async saveRenownData() {
    await game.settings.set('renown-system', 'renownData', this.savedData);
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

    // Tooltip hover - use Foundry's tooltip system
    html.find('.faction-name').hover(
      (event) => {
        const factionName = $(event.currentTarget).data('faction');
        this.showTooltip(event, factionName);
      },
      () => {
        this.hideTooltip();
      }
    );
  }

  async updateBaseRenown(name, value) {
    const data = this.savedData[name];
    if (!data) {
      console.warn(`Renown System: Faction ${name} not found in savedData`);
      return;
    }
    
    const oldRenown = parseFloat(data.baseRenown) || 0;
    const newValue = parseFloat(value) || 0;
    data.baseRenown = newValue;
    const delta = newValue - oldRenown;
    
    this.adjustRelatedRenown(name, delta);
    this.calculateRenown();
    await this.saveRenownData();
    
    // Broadcast to other players
    if (game.user.isGM) {
      game.socket.emit('module.renown-system', {
        type: 'renownUpdate',
        renownData: this.savedData
      });
    }
    
    // Force re-render to show updated values
    this.render();
  }

  async updatePartyActions(name, value) {
    const data = this.savedData[name];
    if (!data) {
      console.warn(`Renown System: Faction ${name} not found in savedData`);
      return;
    }
    
    const oldRenown = parseFloat(data.partyActions) || 0;
    const newValue = parseFloat(value) || 0;
    data.partyActions = newValue;
    const delta = newValue - oldRenown;
    
    this.adjustRelatedRenown(name, delta);
    this.calculateRenown();
    await this.saveRenownData();
    
    // Broadcast to other players
    if (game.user.isGM) {
      game.socket.emit('module.renown-system', {
        type: 'renownUpdate',
        renownData: this.savedData
      });
    }
    
    // Force re-render to show updated values
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
    const bonusKeys = Object.keys(bonuses).map(k => parseInt(k)).sort((a, b) => a - b);
    
    if (bonusKeys.length === 0) return;
    
    // Find closest bonus level
    const closestLevel = bonusKeys.reduce((prev, curr) => 
      Math.abs(curr - totalRenown) < Math.abs(prev - totalRenown) ? curr : prev
    );
    
    const bonusText = bonuses[closestLevel.toString()] || 'No bonus at this level';
    
    // Use Foundry's tooltip system
    const tooltip = $(`<div class="renown-tooltip">
      <strong>${factionName}</strong><br>
      <strong>Current Level: ${closestLevel}</strong><br>
      ${bonusText}
    </div>`);
    
    $(event.currentTarget).append(tooltip);
  }

  hideTooltip() {
    $('.renown-tooltip').remove();
  }

  getDefaultWorldData() {
    // Return default world data with dummy factions to demonstrate the concept
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
      factions: [
        { name: "Example Faction A", bonuses: {
          "-100": "Faction A declares you an enemy and attacks on sight.",
          "-80": "Faction A actively hunts the party.",
          "-60": "Faction A denies services and access.",
          "-40": "Faction A is hostile and uncooperative.",
          "-20": "Faction A is suspicious and wary.",
          "0": "Neutral stance; standard behavior.",
          "20": "Faction A provides minor assistance.",
          "40": "Faction A offers discounts and basic services.",
          "60": "Faction A provides significant support.",
          "80": "Faction A grants access to exclusive resources.",
          "100": "Faction A fully supports the party."
        }},
        { name: "Example Faction B", bonuses: {
          "-100": "Faction B marks you for elimination.",
          "-80": "Faction B actively works against you.",
          "-60": "Faction B blocks your access to resources.",
          "-40": "Faction B is unfriendly and obstructive.",
          "-20": "Faction B is cautious around you.",
          "0": "Neutral stance; no special treatment.",
          "20": "Faction B offers basic cooperation.",
          "40": "Faction B provides helpful services.",
          "60": "Faction B shares valuable information.",
          "80": "Faction B grants special privileges.",
          "100": "Faction B becomes a strong ally."
        }},
        { name: "Example City", bonuses: {
          "-100": "City bars entry to the party.",
          "-80": "City residents are hostile.",
          "-60": "City services are denied.",
          "-40": "City merchants overcharge significantly.",
          "-20": "City residents are distrustful.",
          "0": "Neutral stance; standard city services.",
          "20": "City provides minor discounts.",
          "40": "City offers helpful guides and services.",
          "60": "City grants access to exclusive areas.",
          "80": "City provides free lodging and supplies.",
          "100": "City honors the party as heroes."
        }}
      ],
      relationships: {
        "Example Faction A": {
          friends: ["Example City"],
          enemies: ["Example Faction B"]
        },
        "Example Faction B": {
          friends: [],
          enemies: ["Example Faction A"]
        },
        "Example City": {
          friends: ["Example Faction A"],
          enemies: ["Example Faction B"]
        }
      }
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
    this.graphNetwork = null;
    this.regionalFactionsManager = new RegionalFactionsManager();
    this.regionalData = null;
    this.availableDescriptors = [
      "Pirate", "Naval", "Merchant", "Religious", "Criminal", "Military",
      "Magical", "Noble", "Cult", "City", "Trading", "Warrior", "Scholar",
      "Assassin", "Thief", "Mercenary", "Explorer", "Diplomat", "Artisan",
      "Mystical", "Ancient", "Corrupt", "Lawful", "Chaotic", "Neutral"
    ];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'renown-admin-config',
      title: 'Renown System - World Configuration',
      template: 'modules/renown-system/templates/admin-config.html',
      width: 1200,
      height: 900,
      resizable: true,
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'world' }]
    });
  }

  getData() {
    this.loadWorldData();
    return {
      worldData: this.worldData,
      factions: this.worldData.factions || [],
      relationships: this.worldData.relationships || {}
    };
  }

  loadWorldData() {
    this.worldData = game.settings.get('renown-system', 'worldData');
    if (!this.worldData) {
      this.worldData = this.getDefaultWorldData();
      game.settings.set('renown-system', 'worldData', this.worldData);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Tab switching
    html.find('.tabs a').on('click', (event) => {
      event.preventDefault();
      const tab = $(event.currentTarget).data('tab');
      html.find('.tabs a').removeClass('active');
      html.find('.tab').removeClass('active');
      $(event.currentTarget).addClass('active');
      html.find(`.tab[data-tab="${tab}"]`).addClass('active');

      // Render regional factions when that tab is selected
      if (tab === 'regional') {
        this.renderRegionalFactions(html);
      }
    });

    // Buttons
    html.find('.save-world').on('click', () => this.saveWorld());
    html.find('.export-world').on('click', () => this.exportWorld());
    html.find('.import-world').on('click', () => this.importWorld());
    html.find('.add-faction').on('click', () => this.addFaction());
    html.find('.load-default-world').on('click', () => this.loadDefaultWorld());
    html.find('.show-graph').on('click', () => this.showRelationshipGraph(html));
    
    // Modal close buttons (handle both template and dynamically created modals)
    $(document).on('click', '.close-graph-modal', () => this.closeGraphModal());
    $(document).on('click', '.close-suggestions-modal', () => this.closeSuggestionsModal());
    
    // Also handle clicks outside modal
    $(document).on('click', '.graph-modal', (event) => {
      if ($(event.target).hasClass('graph-modal')) {
        this.closeGraphModal();
      }
    });
    
    $(document).on('click', '.suggestions-modal', (event) => {
      if ($(event.target).hasClass('suggestions-modal')) {
        this.closeSuggestionsModal();
      }
    });
    
    // Render dynamic content
    this.renderFactions(html);
    this.renderRelationships(html);
  }

  async _updateObject(event, formData) {
    // Handle form submission from World & Theme tab
    const updateData = foundry.utils.expandObject(formData);
    if (updateData.worldName) {
      this.worldData.worldName = updateData.worldName;
    }
    if (updateData.theme) {
      this.worldData.theme = foundry.utils.mergeObject(this.worldData.theme, updateData.theme);
      // Convert tableBg from hex to rgba if needed
      if (updateData.theme.tableBg && updateData.theme.tableBg.startsWith('#')) {
        this.worldData.theme.tableBg = this.hexToRgba(updateData.theme.tableBg, 0.9);
      }
    }
    await this.saveWorldData();
    this.render();
  }

  async saveWorld() {
    // Collect form data from World tab
    const form = this.element.find('form')[0];
    const formData = new FormData(form);
    const updateData = {};
    
    for (let [key, value] of formData.entries()) {
      foundry.utils.setProperty(updateData, key, value);
    }
    
    if (updateData.worldName) {
      this.worldData.worldName = updateData.worldName;
    }
    if (updateData.theme) {
      this.worldData.theme = foundry.utils.mergeObject(this.worldData.theme, updateData.theme);
      if (updateData.theme.tableBg && updateData.theme.tableBg.startsWith('#')) {
        this.worldData.theme.tableBg = this.hexToRgba(updateData.theme.tableBg, 0.9);
      }
    }
    
    await this.saveWorldData();
    ui.notifications.info('World configuration saved!');
    
    // Broadcast to other players
    if (game.user.isGM) {
      game.socket.emit('module.renown-system', {
        type: 'worldUpdate',
        worldData: this.worldData
      });
    }
  }

  async saveWorldData() {
    await game.settings.set('renown-system', 'worldData', this.worldData);
  }

  renderFactions(html) {
    const container = html.find('#factionsList');
    container.empty();
    
    if (!this.worldData.factions || this.worldData.factions.length === 0) {
      container.html('<p>No factions defined. Click "Add Faction/City" to create one.</p>');
      return;
    }
    
    this.worldData.factions.forEach((faction, index) => {
      const bonusCount = Object.keys(faction.bonuses || {}).length;
      const descriptorCount = (faction.descriptors || []).length;
      const descriptorsList = (faction.descriptors || []).join(', ') || 'None';
      
      const factionHtml = $(`
        <div class="faction-item" data-index="${index}">
          <div class="faction-header">
            <div>
              <h3>${faction.name}</h3>
              <div class="faction-summary">
                <span>📋 ${bonusCount} bonuses</span>
                <span>🏷️ ${descriptorCount} descriptors</span>
                <span style="font-size: 0.85em; color: #888;">${descriptorsList}</span>
              </div>
            </div>
            <button type="button" class="remove-faction-small" data-index="${index}" title="Remove Faction">×</button>
          </div>
          <div class="faction-content collapsed">
            <div class="form-group">
              <label>Name:</label>
              <input type="text" class="faction-name-input" data-index="${index}" value="${faction.name}">
            </div>
            <div class="form-group">
              <label>Faction/City Type & Descriptors:</label>
              <div class="descriptor-selector">
                <select class="descriptor-select" data-index="${index}">
                  <option value="">-- Select a descriptor to add --</option>
                </select>
                <button type="button" class="generate-suggestions" data-index="${index}">✨ Generate Suggestions</button>
              </div>
              <div class="selected-descriptors" data-index="${index}"></div>
            </div>
            <div class="form-group">
              <label>Bonuses/Penalties:</label>
              <div class="bonuses-container" data-index="${index}"></div>
              <button type="button" class="add-bonus" data-index="${index}">+ Add Bonus/Penalty</button>
            </div>
          </div>
        </div>
      `);
      
      container.append(factionHtml);
      
      // Render descriptors
      this.renderDescriptors(html, index, faction);
      
      // Render bonuses
      this.renderBonuses(html, index, faction);
      
      // Toggle collapse
      factionHtml.find('.faction-header').on('click', () => {
        factionHtml.find('.faction-content').toggleClass('collapsed');
      });
    });
    
    // Event listeners
    html.find('.faction-name-input').on('change', (event) => {
      const index = parseInt($(event.currentTarget).data('index'));
      const newName = $(event.currentTarget).val();
      this.updateFactionName(index, newName);
    });
    
    html.find('.remove-faction-small').on('click', (event) => {
      event.stopPropagation();
      const index = parseInt($(event.currentTarget).data('index'));
      this.removeFaction(index);
    });
    
    html.find('.descriptor-select').on('change', (event) => {
      const index = parseInt($(event.currentTarget).data('index'));
      const descriptor = $(event.currentTarget).val();
      if (descriptor) {
        this.addDescriptor(index, descriptor);
        $(event.currentTarget).val('');
      }
    });
    
    html.find('.generate-suggestions').on('click', (event) => {
      const index = parseInt($(event.currentTarget).data('index'));
      this.generateSuggestions(index);
    });
    
    html.find('.add-bonus').on('click', (event) => {
      const index = parseInt($(event.currentTarget).data('index'));
      this.addBonus(index);
    });
  }

  renderDescriptors(html, index, faction) {
    if (!faction.descriptors) {
      faction.descriptors = [];
    }
    
    const select = html.find(`.descriptor-select[data-index="${index}"]`);
    const container = html.find(`.selected-descriptors[data-index="${index}"]`);
    
    // Populate dropdown
    select.find('option:not(:first)').remove();
    this.availableDescriptors.forEach(desc => {
      if (!faction.descriptors.includes(desc)) {
        select.append(`<option value="${desc}">${desc}</option>`);
      }
    });
    
    // Render selected descriptors
    container.empty();
    faction.descriptors.forEach(desc => {
      const tag = $(`
        <div class="descriptor-tag">
          <span>${desc}</span>
          <button type="button" class="remove-descriptor" data-index="${index}" data-descriptor="${desc}">×</button>
        </div>
      `);
      container.append(tag);
    });
    
    html.find(`.remove-descriptor[data-index="${index}"]`).on('click', (event) => {
      const descriptor = $(event.currentTarget).data('descriptor');
      this.removeDescriptor(index, descriptor);
    });
  }

  renderBonuses(html, index, faction) {
    const container = html.find(`.bonuses-container[data-index="${index}"]`);
    container.empty();
    
    const bonusLevels = Object.keys(faction.bonuses || {}).sort((a, b) => parseInt(a) - parseInt(b));
    
    bonusLevels.forEach(level => {
      const bonus = (faction.bonuses[level] || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const bonusHtml = $(`
        <div class="bonus-entry" data-index="${index}" data-level="${level}">
          <input type="number" class="bonus-level" value="${level}" placeholder="Level" style="width: 80px;">
          <textarea class="bonus-text" placeholder="Description" rows="2" style="flex: 1; min-width: 200px;">${bonus}</textarea>
          <button type="button" class="remove-bonus-small" data-index="${index}" data-level="${level}" title="Remove">×</button>
        </div>
      `);
      container.append(bonusHtml);
    });
    
    // Event listeners for bonuses
    html.find(`.bonus-level[data-index="${index}"]`).on('change', (event) => {
      const oldLevel = $(event.currentTarget).closest('.bonus-entry').data('level') || $(event.currentTarget).val();
      const newLevel = $(event.currentTarget).val();
      if (oldLevel !== newLevel && newLevel) {
        this.updateBonusLevel(index, oldLevel, newLevel);
      }
    });
    
    html.find(`.bonus-text[data-index="${index}"]`).on('change blur', (event) => {
      const level = $(event.currentTarget).closest('.bonus-entry').find('.bonus-level').val();
      const text = $(event.currentTarget).val();
      this.updateBonusText(index, level, text);
    });
    
    html.find(`.remove-bonus-small[data-index="${index}"]`).on('click', (event) => {
      const level = $(event.currentTarget).data('level');
      this.removeBonus(index, level);
    });
  }

  renderRelationships(html) {
    const container = html.find('#relationshipsList');
    container.empty();
    
    if (!this.worldData.factions || this.worldData.factions.length === 0) {
      container.html('<p>No factions defined. Add factions first.</p>');
      return;
    }
    
    this.worldData.factions.forEach((faction, index) => {
      if (!this.worldData.relationships[faction.name]) {
        this.worldData.relationships[faction.name] = { friends: [], enemies: [] };
      }
      
      const friends = this.worldData.relationships[faction.name].friends || [];
      const enemies = this.worldData.relationships[faction.name].enemies || [];
      
      const relHtml = $(`
        <div class="relationship-item" data-faction="${faction.name}">
          <div class="relationship-header">
            <h3>${faction.name}</h3>
            <div class="relationship-summary">
              <span>🤝 ${friends.length} friends</span>
              <span>⚔️ ${enemies.length} enemies</span>
            </div>
          </div>
          <div class="relationship-content collapsed">
            <div class="form-group">
              <label>Friends:</label>
              <div class="friends-list" data-faction="${faction.name}"></div>
              <button type="button" class="add-relationship" data-faction="${faction.name}" data-type="friends">+ Add Friend</button>
            </div>
            <div class="form-group">
              <label>Enemies:</label>
              <div class="enemies-list" data-faction="${faction.name}"></div>
              <button type="button" class="add-relationship" data-faction="${faction.name}" data-type="enemies">+ Add Enemy</button>
            </div>
          </div>
        </div>
      `);
      
      container.append(relHtml);
      
      // Render friends
      const friendsList = relHtml.find('.friends-list');
      friends.forEach((friend, idx) => {
        const friendHtml = this.createRelationshipEntry(faction.name, 'friends', idx, friend);
        friendsList.append(friendHtml);
      });
      
      // Render enemies
      const enemiesList = relHtml.find('.enemies-list');
      enemies.forEach((enemy, idx) => {
        const enemyHtml = this.createRelationshipEntry(faction.name, 'enemies', idx, enemy);
        enemiesList.append(enemyHtml);
      });
      
      // Toggle collapse
      relHtml.find('.relationship-header').on('click', () => {
        relHtml.find('.relationship-content').toggleClass('collapsed');
      });
    });
    
    // Add relationship buttons
    html.find('.add-relationship').on('click', (event) => {
      const factionName = $(event.currentTarget).data('faction');
      const type = $(event.currentTarget).data('type');
      this.addRelationship(factionName, type);
    });
    
    // Relationship select and remove handlers
    html.find('.relationship-select').on('change', (event) => {
      const factionName = $(event.currentTarget).data('faction');
      const type = $(event.currentTarget).data('type');
      const index = parseInt($(event.currentTarget).data('index'));
      const newValue = $(event.currentTarget).val();
      this.updateRelationship(factionName, type, index, newValue);
    });
    
    html.find('.remove-relationship-small').on('click', (event) => {
      const factionName = $(event.currentTarget).data('faction');
      const type = $(event.currentTarget).data('type');
      const index = parseInt($(event.currentTarget).data('index'));
      this.removeRelationship(factionName, type, index);
    });
  }
  
  updateRelationship(factionName, type, index, newValue) {
    this.worldData.relationships[factionName][type][index] = newValue;
    this.saveWorldData();
  }

  createRelationshipEntry(factionName, type, index, currentValue) {
    const availableFactions = this.worldData.factions
      .filter(f => f.name !== factionName)
      .map(f => f.name);
    
    let options = '';
    availableFactions.forEach(f => {
      const selected = f === currentValue ? 'selected' : '';
      options += `<option value="${f}" ${selected}>${f}</option>`;
    });
    
    return $(`
      <div class="relationship-entry">
        <select class="relationship-select" data-faction="${factionName}" data-type="${type}" data-index="${index}" style="flex: 1;">
          ${options}
        </select>
        <button type="button" class="remove-relationship-small" data-faction="${factionName}" data-type="${type}" data-index="${index}" title="Remove">×</button>
      </div>
    `);
  }

  // Faction management methods
  addFaction() {
    this.worldData.factions.push({
      name: "New Faction",
      bonuses: { "0": "Neutral stance." },
      descriptors: []
    });
    if (!this.worldData.relationships["New Faction"]) {
      this.worldData.relationships["New Faction"] = { friends: [], enemies: [] };
    }
    this.saveWorldData();
    this.render();
  }

  removeFaction(index) {
    const faction = this.worldData.factions[index];
    delete this.worldData.relationships[faction.name];
    this.worldData.factions.splice(index, 1);
    this.saveWorldData();
    this.render();
  }

  updateFactionName(index, newName) {
    const oldName = this.worldData.factions[index].name;
    this.worldData.factions[index].name = newName;
    if (this.worldData.relationships[oldName]) {
      this.worldData.relationships[newName] = this.worldData.relationships[oldName];
      delete this.worldData.relationships[oldName];
    } else {
      this.worldData.relationships[newName] = { friends: [], enemies: [] };
    }
    this.saveWorldData();
    this.render();
  }

  addDescriptor(index, descriptor) {
    if (!this.worldData.factions[index].descriptors) {
      this.worldData.factions[index].descriptors = [];
    }
    if (!this.worldData.factions[index].descriptors.includes(descriptor)) {
      this.worldData.factions[index].descriptors.push(descriptor);
      this.saveWorldData();
      this.render();
    }
  }

  removeDescriptor(index, descriptor) {
    if (!this.worldData.factions[index].descriptors) {
      this.worldData.factions[index].descriptors = [];
    }
    this.worldData.factions[index].descriptors = this.worldData.factions[index].descriptors.filter(d => d !== descriptor);
    this.saveWorldData();
    this.render();
  }

  addBonus(index) {
    Dialog.prompt({
      title: 'Add Bonus/Penalty',
      content: '<p>Enter renown level (e.g., -100, 0, 100):</p>',
      label: 'Add',
      callback: (html) => {
        const level = html.find('input[type="text"]').val();
        if (level !== null && level !== "") {
          if (!this.worldData.factions[index].bonuses) {
            this.worldData.factions[index].bonuses = {};
          }
          this.worldData.factions[index].bonuses[level] = "";
          this.saveWorldData();
          this.render();
        }
      }
    });
  }

  updateBonusLevel(index, oldLevel, newLevel) {
    const faction = this.worldData.factions[index];
    if (oldLevel !== newLevel && newLevel !== "") {
      faction.bonuses[newLevel] = faction.bonuses[oldLevel] || "";
      delete faction.bonuses[oldLevel];
      this.saveWorldData();
      this.render();
    }
  }

  updateBonusText(index, level, text) {
    this.worldData.factions[index].bonuses[level] = text;
    this.saveWorldData();
  }

  removeBonus(index, level) {
    delete this.worldData.factions[index].bonuses[level];
    this.saveWorldData();
    this.render();
  }

  // Relationship management
  addRelationship(factionName, type) {
    if (!this.worldData.relationships[factionName][type]) {
      this.worldData.relationships[factionName][type] = [];
    }
    const availableFactions = this.worldData.factions.filter(f => f.name !== factionName).map(f => f.name);
    if (availableFactions.length === 0) {
      ui.notifications.warn("No other factions available to add as relationship.");
      return;
    }
    this.worldData.relationships[factionName][type].push(availableFactions[0]);
    this.saveWorldData();
    this.render();
  }

  removeRelationship(factionName, type, index) {
    this.worldData.relationships[factionName][type].splice(index, 1);
    this.saveWorldData();
    this.render();
  }

  // Export/Import
  exportWorld() {
    this.saveWorld();
    const dataStr = JSON.stringify(this.worldData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.worldData.worldName.replace(/[^a-z0-9]/gi, '_')}_world.json`;
    a.click();
    URL.revokeObjectURL(url);
    ui.notifications.info("World exported successfully!");
  }

  importWorld() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.factions && imported.theme && imported.relationships) {
            this.worldData = imported;
            await this.saveWorldData();
            this.render();
            ui.notifications.info('World imported successfully!');
            
            // Broadcast to other players
            if (game.user.isGM) {
              game.socket.emit('module.renown-system', {
                type: 'worldUpdate',
                worldData: this.worldData
              });
            }
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

  loadDefaultWorld() {
    Dialog.confirm({
      title: 'Load Default World',
      content: '<p>This will replace your current world configuration with the default. Continue?</p>',
      yes: () => {
        this.worldData = this.getDefaultWorldData();
        this.saveWorldData();
        this.render();
        ui.notifications.info('Default world loaded');
      },
      no: () => {}
    });
  }

  // Relationship Graph
  showRelationshipGraph(html) {
    // The modal is in the template but might not be in the form's scope
    // Try to find it in the document body or create it
    let modal = $('#graphModal');
    if (modal.length === 0) {
      // Create the modal if it doesn't exist
      modal = $(`
        <div id="graphModal" class="graph-modal" style="display: none;">
          <div class="graph-modal-content">
            <span class="close-graph-modal">&times;</span>
            <h2>Relationship Graph</h2>
            <div class="graph-legend">
              <strong>Legend:</strong>
              <span style="color: #4a9eff; margin-left: 20px;">🔵 Faction</span>
              <span style="color: #ffdd8b; margin-left: 20px;">🟡 City</span>
              <span style="color: #28a745; margin-left: 20px;">━━━ Friends</span>
              <span style="color: #dc3545; margin-left: 20px;">━━━ Enemies</span>
            </div>
            <div id="relationshipGraph" class="relationship-graph-container"></div>
          </div>
        </div>
      `);
      $('body').append(modal);
      
      // Add close handler
      modal.find('.close-graph-modal').on('click', () => this.closeGraphModal());
    }
    
    modal.show();
    
    // Check if vis.js is available (load it dynamically if needed)
    if (typeof vis === 'undefined') {
      // Load vis.js from CDN
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js';
      script.onload = () => {
        this.createRelationshipGraph(html);
      };
      script.onerror = () => {
        html.find('#relationshipGraph').html('<p style="color: red;">Failed to load graph library. Please check your internet connection.</p>');
      };
      document.head.appendChild(script);
      html.find('#relationshipGraph').html('<p>Loading graph library...</p>');
    } else {
      this.createRelationshipGraph(html);
    }
  }

  createRelationshipGraph(html) {
    const container = html.find('#relationshipGraph')[0];
    if (!container) {
      html.find('#relationshipGraph').html('<p style="color: red;">Graph container not found.</p>');
      return;
    }
    
    if (typeof vis === 'undefined') {
      html.find('#relationshipGraph').html('<p style="color: red;">Graph library not loaded. Please refresh and try again.</p>');
      return;
    }

    // Clear previous graph
    if (this.graphNetwork) {
      this.graphNetwork.destroy();
      this.graphNetwork = null;
    }

    // Prepare nodes (factions/cities)
    const nodes = [];
    const nodeMap = {};
    
    this.worldData.factions.forEach((faction, index) => {
      const isCity = faction.name.startsWith("City:");
      const nodeId = index;
      nodeMap[faction.name] = nodeId;
      
      nodes.push({
        id: nodeId,
        label: faction.name.replace("City: ", ""),
        title: faction.name,
        color: {
          background: isCity ? "#ffdd8b" : "#4a9eff",
          border: isCity ? "#ffaa00" : "#2e6bb3",
          highlight: {
            background: isCity ? "#ffed99" : "#6bb0ff",
            border: isCity ? "#ffaa00" : "#2e6bb3"
          }
        },
        shape: isCity ? "diamond" : "dot",
        size: 25,
        font: { size: 14, color: "#e0e0e0" }
      });
    });

    // Prepare edges (relationships)
    const edges = [];
    const edgeMap = {};
    
    Object.keys(this.worldData.relationships || {}).forEach(factionName => {
      const fromId = nodeMap[factionName];
      if (fromId === undefined) return;
      
      const relationships = this.worldData.relationships[factionName];
      
      // Friend relationships (green)
      (relationships.friends || []).forEach(friendName => {
        const toId = nodeMap[friendName];
        if (toId !== undefined) {
          const edgeKey = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}-friend`;
          if (!edgeMap[edgeKey]) {
            edges.push({
              from: fromId,
              to: toId,
              color: { color: "#28a745", highlight: "#4caf50" },
              width: 3,
              dashes: false,
              title: `${factionName} ↔ ${friendName} (Friends)`
            });
            edgeMap[edgeKey] = true;
          }
        }
      });
      
      // Enemy relationships (red)
      (relationships.enemies || []).forEach(enemyName => {
        const toId = nodeMap[enemyName];
        if (toId !== undefined) {
          const edgeKey = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}-enemy`;
          if (!edgeMap[edgeKey]) {
            edges.push({
              from: fromId,
              to: toId,
              color: { color: "#dc3545", highlight: "#f44336" },
              width: 3,
              dashes: [5, 5],
              title: `${factionName} ↔ ${enemyName} (Enemies)`
            });
            edgeMap[edgeKey] = true;
          }
        }
      });
    });

    const data = { nodes: nodes, edges: edges };
    
    const options = {
      nodes: {
        borderWidth: 2,
        shadow: true,
        font: { size: 14, face: "'IM Fell English SC', serif" }
      },
      edges: {
        smooth: { type: "continuous", roundness: 0.5 },
        shadow: true
      },
      physics: {
        enabled: true,
        stabilization: { enabled: true, iterations: 200 },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.1,
          springLength: 200,
          springConstant: 0.04,
          damping: 0.09
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true
      },
      layout: {
        improvedLayout: true
      }
    };

    try {
      this.graphNetwork = new vis.Network(container, data, options);
      
      // Add click handler to show faction details
      this.graphNetwork.on("click", (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const faction = this.worldData.factions[nodeId];
          if (faction) {
            this.showFactionDetailsInGraph(faction);
          }
        }
      });
    } catch (error) {
      console.error('Renown System: Error creating graph', error);
      html.find('#relationshipGraph').html(`<p style="color: red;">Error creating graph: ${error.message}</p>`);
    }
  }

  showFactionDetailsInGraph(faction) {
    const bonusLevels = Object.keys(faction.bonuses || {}).sort((a, b) => parseInt(a) - parseInt(b));
    let bonusText = `<strong>${faction.name}</strong><br><br><strong>Bonuses/Penalties:</strong><br>`;
    
    bonusLevels.forEach(level => {
      const bonus = faction.bonuses[level];
      const color = parseInt(level) < 0 ? "#dc3545" : parseInt(level) > 0 ? "#28a745" : "#4682b4";
      bonusText += `<span style="color: ${color};">Level ${level}:</span> ${bonus}<br>`;
    });
    
    Dialog.prompt({
      title: 'Faction Details',
      content: bonusText,
      label: 'Close',
      callback: () => {}
    });
  }

  closeGraphModal() {
    if (this.graphNetwork) {
      this.graphNetwork.destroy();
      this.graphNetwork = null;
    }
    const modal = $('#graphModal');
    if (modal.length > 0) {
      modal.hide();
    }
  }

  closeSuggestionsModal() {
    $('#suggestionsModal').hide();
  }

  getSuggestionTemplates() {
    return {
      "Pirate": {
        negative: [
          { level: -100, text: "Pirate fleet relentlessly hunts the party." },
          { level: -80, text: "Bounty issued; pirates target the party." },
          { level: -60, text: "Frequent pirate ambushes." },
          { level: -40, text: "Pirates demand gold or tribute." },
          { level: -20, text: "Increased chance of pirate encounters." }
        ],
        positive: [
          { level: 20, text: "Discounts on smuggled goods (20%)." },
          { level: 40, text: "Safe passage in pirate-controlled areas." },
          { level: 60, text: "Black-market goods provided at no cost." },
          { level: 80, text: "Free crew recruitment." },
          { level: 100, text: "Full pirate fleet support." }
        ]
      },
      "Naval": {
        negative: [
          { level: -100, text: "Full bounty issued; attacked on sight." },
          { level: -80, text: "Naval forces pursue the party aggressively." },
          { level: -60, text: "Docking privileges denied." },
          { level: -40, text: "Frequent inspections delay travel." },
          { level: -20, text: "Naval forces are suspicious and unfriendly." }
        ],
        positive: [
          { level: 20, text: "Minor supplies provided for free." },
          { level: 40, text: "Discounted repairs (50%) at naval docks." },
          { level: 60, text: "Access to naval intelligence." },
          { level: 80, text: "Free ship upgrades." },
          { level: 100, text: "Full naval support in conflicts." }
        ]
      },
      "Merchant": {
        negative: [
          { level: -100, text: "Merchants sabotage the party's plans." },
          { level: -80, text: "Trade routes blocked." },
          { level: -60, text: "Merchants refuse to trade." },
          { level: -40, text: "False rumors spread about the party." },
          { level: -20, text: "Minor overcharging on goods/services." }
        ],
        positive: [
          { level: 20, text: "Access to exclusive auctions." },
          { level: 40, text: "Discounts on rare items (50%)." },
          { level: 60, text: "Merchants broker alliances for the party." },
          { level: 80, text: "Reveals hidden relic locations." },
          { level: 100, text: "Free access to rare treasures." }
        ]
      },
      "Religious": {
        negative: [
          { level: -100, text: "Declared heretics; full ban from area." },
          { level: -80, text: "Religious authorities refuse to interact." },
          { level: -60, text: "Temples block access." },
          { level: -40, text: "Priests and merchants overcharge." },
          { level: -20, text: "Locals are suspicious." }
        ],
        positive: [
          { level: 20, text: "Access to festivals and blessings." },
          { level: 40, text: "Discounts on magical rituals." },
          { level: 60, text: "Free divine blessings." },
          { level: 80, text: "Priests grant rare relics." },
          { level: 100, text: "Full divine support for the party." }
        ]
      },
      "Criminal": {
        negative: [
          { level: -100, text: "Criminal organization targets you for elimination." },
          { level: -80, text: "Spies infiltrate your crew." },
          { level: -60, text: "Criminal ambushes." },
          { level: -40, text: "Criminals set traps." },
          { level: -20, text: "Criminal agents monitor your movements." }
        ],
        positive: [
          { level: 20, text: "Discounts on illegal goods (20%)." },
          { level: 40, text: "Criminal contacts provide intelligence." },
          { level: 60, text: "Access to criminal networks." },
          { level: 80, text: "Secret routes revealed." },
          { level: 100, text: "Criminal organization provides services." }
        ]
      },
      "Military": {
        negative: [
          { level: -100, text: "Military declares you an enemy." },
          { level: -80, text: "Military forces hunt you." },
          { level: -60, text: "Military blocks your access." },
          { level: -40, text: "Military inspections delay you." },
          { level: -20, text: "Military is wary of you." }
        ],
        positive: [
          { level: 20, text: "Minor military supplies provided." },
          { level: 40, text: "Discounted military equipment." },
          { level: 60, text: "Access to military intelligence." },
          { level: 80, text: "Military provides protection." },
          { level: 100, text: "Full military support in conflicts." }
        ]
      },
      "Magical": {
        negative: [
          { level: -100, text: "Mages target you with powerful spells." },
          { level: -80, text: "Allies turned against you by magic." },
          { level: -60, text: "Navigation obscured by illusion magic." },
          { level: -40, text: "Ambushes by enchanted forces." },
          { level: -20, text: "Mages attempt to manipulate you." }
        ],
        positive: [
          { level: 20, text: "Discounts on magic items." },
          { level: 40, text: "Safe passage allowed." },
          { level: 60, text: "Invitations to hidden sanctuaries." },
          { level: 80, text: "Mages weave protective spells." },
          { level: 100, text: "Access to powerful enchantments." }
        ]
      },
      "City": {
        negative: [
          { level: -100, text: "City bars the party entry." },
          { level: -80, text: "Residents alert hostile factions." },
          { level: -60, text: "Guides and merchants refuse service." },
          { level: -40, text: "Merchants overcharge (50% increase)." },
          { level: -20, text: "Locals distrust the party." }
        ],
        positive: [
          { level: 20, text: "Reduced cost for guides and maps." },
          { level: 40, text: "Discounts on local goods." },
          { level: 60, text: "Free guides and equipment." },
          { level: 80, text: "Local escorts provided." },
          { level: 100, text: "Free lodging and supplies." }
        ]
      },
      "Noble": {
        negative: [
          { level: -100, text: "Nobles declare you persona non grata." },
          { level: -80, text: "Noble houses blacklist you from high society." },
          { level: -60, text: "Nobles refuse to grant audiences." },
          { level: -40, text: "Nobles spread rumors to damage your reputation." },
          { level: -20, text: "Nobles treat you with cold disdain." }
        ],
        positive: [
          { level: 20, text: "Minor noble favors granted." },
          { level: 40, text: "Access to noble events and galas." },
          { level: 60, text: "Nobles provide political support." },
          { level: 80, text: "Noble houses offer alliances." },
          { level: 100, text: "Granted noble title and full privileges." }
        ]
      },
      "Cult": {
        negative: [
          { level: -100, text: "Cult declares you a heretic and enemy." },
          { level: -80, text: "Cultists hunt you relentlessly." },
          { level: -60, text: "Cultists perform dark rituals against you." },
          { level: -40, text: "Cult spreads fear and suspicion about you." },
          { level: -20, text: "Cultists watch you with suspicion." }
        ],
        positive: [
          { level: 20, text: "Cultists provide minor information." },
          { level: 40, text: "Access to cult sanctuaries." },
          { level: 60, text: "Cultists perform rituals to aid you." },
          { level: 80, text: "Initiated into cult secrets." },
          { level: 100, text: "Elevated to cult leadership." }
        ]
      },
      "Trading": {
        negative: [
          { level: -100, text: "Trading guilds ban you from all markets." },
          { level: -80, text: "Merchants refuse all business with you." },
          { level: -60, text: "Trade routes closed to you." },
          { level: -40, text: "Merchants charge exorbitant prices." },
          { level: -20, text: "Merchants are reluctant to deal." }
        ],
        positive: [
          { level: 20, text: "Access to exclusive trading posts." },
          { level: 40, text: "Discounts on trade goods (30%)." },
          { level: 60, text: "Trading guilds share market intelligence." },
          { level: 80, text: "Priority access to rare commodities." },
          { level: 100, text: "Honorary membership in trading guilds." }
        ]
      },
      "Warrior": {
        negative: [
          { level: -100, text: "Warriors declare you a sworn enemy." },
          { level: -80, text: "Warrior bands hunt you for sport." },
          { level: -60, text: "Warriors challenge you to deadly duels." },
          { level: -40, text: "Warriors spread tales of your cowardice." },
          { level: -20, text: "Warriors mock and belittle you." }
        ],
        positive: [
          { level: 20, text: "Warriors respect your combat prowess." },
          { level: 40, text: "Access to warrior training grounds." },
          { level: 60, text: "Warriors offer to fight alongside you." },
          { level: 80, text: "Access to legendary weapons and armor." },
          { level: 100, text: "Declared champion and granted warrior title." }
        ]
      },
      "Scholar": {
        negative: [
          { level: -100, text: "Scholars declare your research heretical." },
          { level: -80, text: "Libraries and academies ban you." },
          { level: -60, text: "Scholars refuse to share knowledge." },
          { level: -40, text: "Scholars spread false information about you." },
          { level: -20, text: "Scholars are dismissive of your questions." }
        ],
        positive: [
          { level: 20, text: "Scholars share basic information." },
          { level: 40, text: "Access to restricted libraries." },
          { level: 60, text: "Scholars provide rare knowledge." },
          { level: 80, text: "Invited to exclusive academic circles." },
          { level: 100, text: "Granted access to ancient and forbidden texts." }
        ]
      },
      "Assassin": {
        negative: [
          { level: -100, text: "Assassins place a contract on your life." },
          { level: -80, text: "Assassins actively hunt you." },
          { level: -60, text: "Assassins attempt to poison you." },
          { level: -40, text: "Assassins sabotage your plans." },
          { level: -20, text: "Assassins watch you from the shadows." }
        ],
        positive: [
          { level: 20, text: "Assassins ignore you." },
          { level: 40, text: "Assassins share basic intelligence." },
          { level: 60, text: "Access to assassination services." },
          { level: 80, text: "Assassins provide protection." },
          { level: 100, text: "Honorary member of the assassins' guild." }
        ]
      },
      "Thief": {
        negative: [
          { level: -100, text: "Thieves' guild marks you for death." },
          { level: -80, text: "Thieves constantly rob you." },
          { level: -60, text: "Thieves sabotage your equipment." },
          { level: -40, text: "Thieves spread rumors about your wealth." },
          { level: -20, text: "Thieves target you for pickpocketing." }
        ],
        positive: [
          { level: 20, text: "Thieves leave you alone." },
          { level: 40, text: "Thieves share information about targets." },
          { level: 60, text: "Access to stolen goods markets." },
          { level: 80, text: "Thieves provide lockpicking services." },
          { level: 100, text: "Honorary member of the thieves' guild." }
        ]
      },
      "Mercenary": {
        negative: [
          { level: -100, text: "Mercenaries are hired to eliminate you." },
          { level: -80, text: "Mercenary companies hunt you." },
          { level: -60, text: "Mercenaries refuse to work with you." },
          { level: -40, text: "Mercenaries charge exorbitant rates." },
          { level: -20, text: "Mercenaries are untrustworthy around you." }
        ],
        positive: [
          { level: 20, text: "Mercenaries offer standard rates." },
          { level: 40, text: "Discounts on mercenary services (25%)." },
          { level: 60, text: "Mercenaries provide reliable protection." },
          { level: 80, text: "Access to elite mercenary companies." },
          { level: 100, text: "Mercenaries fight for you at no cost." }
        ]
      },
      "Explorer": {
        negative: [
          { level: -100, text: "Explorers sabotage your expeditions." },
          { level: -80, text: "Explorers refuse to share maps." },
          { level: -60, text: "Explorers spread false information." },
          { level: -40, text: "Explorers charge high prices for guides." },
          { level: -20, text: "Explorers are reluctant to help." }
        ],
        positive: [
          { level: 20, text: "Explorers share basic maps." },
          { level: 40, text: "Access to detailed exploration reports." },
          { level: 60, text: "Explorers guide you to hidden locations." },
          { level: 80, text: "Access to secret routes and shortcuts." },
          { level: 100, text: "Explorers share all discovered treasures." }
        ]
      },
      "Diplomat": {
        negative: [
          { level: -100, text: "Diplomats work against you in all negotiations." },
          { level: -80, text: "Diplomatic channels closed to you." },
          { level: -60, text: "Diplomats spread negative propaganda." },
          { level: -40, text: "Diplomats refuse to meet with you." },
          { level: -20, text: "Diplomats are cold and unhelpful." }
        ],
        positive: [
          { level: 20, text: "Diplomats provide basic introductions." },
          { level: 40, text: "Access to diplomatic circles." },
          { level: 60, text: "Diplomats broker important alliances." },
          { level: 80, text: "Diplomatic immunity granted." },
          { level: 100, text: "Honored as a master diplomat." }
        ]
      },
      "Artisan": {
        negative: [
          { level: -100, text: "Artisans refuse to work for you." },
          { level: -80, text: "Guilds blacklist you from services." },
          { level: -60, text: "Artisans sabotage your orders." },
          { level: -40, text: "Artisans charge triple prices." },
          { level: -20, text: "Artisans are slow and uncooperative." }
        ],
        positive: [
          { level: 20, text: "Artisans provide standard services." },
          { level: 40, text: "Discounts on crafted items (30%)." },
          { level: 60, text: "Access to master craftsmen." },
          { level: 80, text: "Artisans create custom masterpieces." },
          { level: 100, text: "Honorary guild member with free services." }
        ]
      },
      "Mystical": {
        negative: [
          { level: -100, text: "Mystical forces curse you." },
          { level: -80, text: "Mystical barriers block your path." },
          { level: -60, text: "Mystical entities harass you." },
          { level: -40, text: "Mystical visions mislead you." },
          { level: -20, text: "Mystical energies feel hostile." }
        ],
        positive: [
          { level: 20, text: "Mystical forces are neutral." },
          { level: 40, text: "Mystical visions guide you." },
          { level: 60, text: "Access to mystical sanctuaries." },
          { level: 80, text: "Mystical entities aid you." },
          { level: 100, text: "Blessed by mystical powers." }
        ]
      },
      "Ancient": {
        negative: [
          { level: -100, text: "Ancient guardians hunt you." },
          { level: -80, text: "Ancient ruins are sealed from you." },
          { level: -60, text: "Ancient curses affect you." },
          { level: -40, text: "Ancient knowledge is hidden from you." },
          { level: -20, text: "Ancient sites feel unwelcoming." }
        ],
        positive: [
          { level: 20, text: "Ancient sites allow basic access." },
          { level: 40, text: "Ancient guardians provide guidance." },
          { level: 60, text: "Access to ancient libraries." },
          { level: 80, text: "Ancient secrets revealed to you." },
          { level: 100, text: "Honored as keeper of ancient wisdom." }
        ]
      },
      "Corrupt": {
        negative: [
          { level: -100, text: "Corrupt officials frame you for crimes." },
          { level: -80, text: "Corrupt networks target you." },
          { level: -60, text: "Corrupt officials demand bribes." },
          { level: -40, text: "Corrupt systems work against you." },
          { level: -20, text: "Corrupt officials are unhelpful." }
        ],
        positive: [
          { level: 20, text: "Corrupt officials ignore you." },
          { level: 40, text: "Corrupt networks provide information." },
          { level: 60, text: "Access to corrupt networks." },
          { level: 80, text: "Corrupt officials grant favors." },
          { level: 100, text: "Integrated into corrupt power structure." }
        ]
      },
      "Lawful": {
        negative: [
          { level: -100, text: "Lawful authorities declare you an outlaw." },
          { level: -80, text: "Lawful forces hunt you." },
          { level: -60, text: "Lawful officials deny you services." },
          { level: -40, text: "Lawful authorities are suspicious." },
          { level: -20, text: "Lawful officials are uncooperative." }
        ],
        positive: [
          { level: 20, text: "Lawful authorities treat you fairly." },
          { level: 40, text: "Access to lawful services and protection." },
          { level: 60, text: "Lawful authorities provide support." },
          { level: 80, text: "Granted legal privileges and immunities." },
          { level: 100, text: "Honored as a champion of law and order." }
        ]
      },
      "Chaotic": {
        negative: [
          { level: -100, text: "Chaotic forces actively work against you." },
          { level: -80, text: "Chaotic agents sabotage your plans." },
          { level: -60, text: "Chaotic forces create obstacles." },
          { level: -40, text: "Chaotic agents spread disorder around you." },
          { level: -20, text: "Chaotic forces are unpredictable." }
        ],
        positive: [
          { level: 20, text: "Chaotic forces leave you alone." },
          { level: 40, text: "Chaotic agents provide information." },
          { level: 60, text: "Access to chaotic networks." },
          { level: 80, text: "Chaotic forces aid your plans." },
          { level: 100, text: "Embraced as an agent of chaos." }
        ]
      },
      "Neutral": {
        negative: [
          { level: -100, text: "Neutral parties actively avoid you." },
          { level: -80, text: "Neutral forces refuse to interact." },
          { level: -60, text: "Neutral parties are unhelpful." },
          { level: -40, text: "Neutral forces are indifferent." },
          { level: -20, text: "Neutral parties are distant." }
        ],
        positive: [
          { level: 20, text: "Neutral parties are friendly." },
          { level: 40, text: "Neutral forces provide basic aid." },
          { level: 60, text: "Neutral parties offer balanced support." },
          { level: 80, text: "Neutral forces grant favors." },
          { level: 100, text: "Respected as a balanced mediator." }
        ]
      }
    };
  }

  generateSuggestions(index) {
    const faction = this.worldData.factions[index];
    const descriptors = faction.descriptors || [];
    
    if (descriptors.length === 0) {
      ui.notifications.warn("Please select at least one descriptor to generate suggestions.");
      return;
    }

    const suggestionTemplates = this.getSuggestionTemplates();
    const suggestions = {};
    const allSuggestions = {}; // Collect all suggestions per level

    // Collect suggestions from all selected descriptors
    descriptors.forEach(desc => {
      const template = suggestionTemplates[desc];
      if (template) {
        template.negative.forEach(item => {
          if (!allSuggestions[item.level]) {
            allSuggestions[item.level] = [];
          }
          allSuggestions[item.level].push(item.text);
        });
        template.positive.forEach(item => {
          if (!allSuggestions[item.level]) {
            allSuggestions[item.level] = [];
          }
          allSuggestions[item.level].push(item.text);
        });
      }
    });

    // For each level, pick the best suggestion or combine them
    Object.keys(allSuggestions).forEach(level => {
      const levelSuggestions = allSuggestions[level];
      if (levelSuggestions.length === 1) {
        suggestions[level] = levelSuggestions[0];
      } else {
        // If multiple descriptors, randomly pick one (could be made smarter)
        suggestions[level] = levelSuggestions[Math.floor(Math.random() * levelSuggestions.length)];
      }
    });

    // Add neutral suggestion if missing
    if (!suggestions[0]) {
      const neutralTexts = [
        "Neutral stance; standard behavior.",
        "Neutral stance; they observe you.",
        "Neutral stance; no special treatment.",
        "Neutral stance; standard services."
      ];
      suggestions[0] = neutralTexts[Math.floor(Math.random() * neutralTexts.length)];
    }

    // Ensure we have suggestions for all standard levels
    const standardLevels = [-100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100];
    standardLevels.forEach(level => {
      if (!suggestions[level]) {
        // Generate a generic suggestion based on descriptors
        const isNegative = level < 0;
        const isCity = descriptors.includes("City");
        const isPirate = descriptors.includes("Pirate");
        const isMerchant = descriptors.includes("Merchant");
        const isReligious = descriptors.includes("Religious");
        
        if (isNegative) {
          if (isCity) {
            suggestions[level] = `City residents become increasingly hostile.`;
          } else if (isPirate) {
            suggestions[level] = `Pirates target the party more frequently.`;
          } else if (isMerchant) {
            suggestions[level] = `Merchants refuse to deal with the party.`;
          } else {
            suggestions[level] = `The faction becomes increasingly hostile.`;
          }
        } else if (level > 0) {
          if (isCity) {
            suggestions[level] = `City provides better services and discounts.`;
          } else if (isPirate) {
            suggestions[level] = `Pirates offer better deals and safe passage.`;
          } else if (isMerchant) {
            suggestions[level] = `Merchants offer exclusive deals and rare goods.`;
          } else if (isReligious) {
            suggestions[level] = `Religious authorities grant blessings and access.`;
          } else {
            suggestions[level] = `The faction provides increasing benefits.`;
          }
        }
      }
    });

    // Display suggestions in modal
    this.showSuggestionsModal(index, faction.name, suggestions);
  }

  showSuggestionsModal(factionIndex, factionName, suggestions) {
    // Ensure modal exists
    let modal = $('#suggestionsModal');
    if (modal.length === 0) {
      // Create modal dynamically if not in template
      modal = $(`
        <div id="suggestionsModal" class="suggestions-modal" style="display: none;">
          <div class="suggestions-modal-content">
            <span class="close-suggestions-modal">&times;</span>
            <h2 id="suggestionsTitle">Bonus Suggestions</h2>
            <div id="suggestionsContent"></div>
          </div>
        </div>
      `);
      $('body').append(modal);
      
      // Add close handler
      modal.find('.close-suggestions-modal').on('click', () => this.closeSuggestionsModal());
      
      // Close on outside click
      modal.on('click', (event) => {
        if ($(event.target).hasClass('suggestions-modal')) {
          this.closeSuggestionsModal();
        }
      });
    }
    
    const content = modal.find('#suggestionsContent');
    const title = modal.find('#suggestionsTitle');
    
    // Store suggestions for applyAll
    this.currentSuggestions = { ...suggestions };
    modal.data('faction-index', factionIndex);
    
    title.text(`Bonus Suggestions for ${factionName}`);
    content.empty();
    
    const sortedLevels = Object.keys(suggestions).sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedLevels.forEach(level => {
      const div = $('<div class="suggestion-item"></div>');
      const escapedText = suggestions[level].replace(/'/g, "&#39;").replace(/"/g, "&quot;");
      div.html(`
        <h4>Renown Level: ${level}</h4>
        <p>${suggestions[level]}</p>
        <button type="button" class="apply-suggestion" data-index="${factionIndex}" data-level="${level}" data-text="${escapedText}">Apply This Suggestion</button>
      `);
      content.append(div);
    });

    // Add "Apply All" button
    const applyAllDiv = $('<div style="text-align: center; margin-top: 20px;"></div>');
    const applyAllBtn = $('<button type="button" class="apply-all-suggestions" data-index="' + factionIndex + '">Apply All Suggestions</button>');
    applyAllBtn.addClass('success');
    applyAllDiv.append(applyAllBtn);
    content.append(applyAllDiv);

    // Set up event handlers
    modal.find('.apply-suggestion').on('click', (event) => {
      const index = parseInt($(event.currentTarget).data('index'));
      const level = $(event.currentTarget).data('level');
      const text = $(event.currentTarget).data('text').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      this.applySuggestion(index, level, text);
    });
    
    modal.find('.apply-all-suggestions').on('click', (event) => {
      const index = parseInt($(event.currentTarget).data('index'));
      this.applyAllSuggestions(index);
    });

    modal.show();
  }

  applySuggestion(factionIndex, level, text) {
    const faction = this.worldData.factions[factionIndex];
    if (!faction.bonuses) {
      faction.bonuses = {};
    }
    faction.bonuses[level] = text;
    this.saveWorldData();
    this.render();
    ui.notifications.info("Suggestion applied!");
  }

  applyAllSuggestions(factionIndex) {
    const faction = this.worldData.factions[factionIndex];
    if (!faction.bonuses) {
      faction.bonuses = {};
    }
    Object.keys(this.currentSuggestions).forEach(level => {
      faction.bonuses[level] = this.currentSuggestions[level];
    });
    this.saveWorldData();
    this.closeSuggestionsModal();
    this.render();
    ui.notifications.info("All suggestions applied!");
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getDefaultWorldData() {
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
      factions: [
        { name: "Example Faction A", bonuses: {
          "-100": "Faction A declares you an enemy and attacks on sight.",
          "-80": "Faction A actively hunts the party.",
          "-60": "Faction A denies services and access.",
          "-40": "Faction A is hostile and uncooperative.",
          "-20": "Faction A is suspicious and wary.",
          "0": "Neutral stance; standard behavior.",
          "20": "Faction A provides minor assistance.",
          "40": "Faction A offers discounts and basic services.",
          "60": "Faction A provides significant support.",
          "80": "Faction A grants access to exclusive resources.",
          "100": "Faction A fully supports the party."
        }, descriptors: []},
        { name: "Example Faction B", bonuses: {
          "-100": "Faction B marks you for elimination.",
          "-80": "Faction B actively works against you.",
          "-60": "Faction B blocks your access to resources.",
          "-40": "Faction B is unfriendly and obstructive.",
          "-20": "Faction B is cautious around you.",
          "0": "Neutral stance; no special treatment.",
          "20": "Faction B offers basic cooperation.",
          "40": "Faction B provides helpful services.",
          "60": "Faction B shares valuable information.",
          "80": "Faction B grants special privileges.",
          "100": "Faction B becomes a strong ally."
        }, descriptors: []},
        { name: "Example City", bonuses: {
          "-100": "City bars entry to the party.",
          "-80": "City residents are hostile.",
          "-60": "City services are denied.",
          "-40": "City merchants overcharge significantly.",
          "-20": "City residents are distrustful.",
          "0": "Neutral stance; standard city services.",
          "20": "City provides minor discounts.",
          "40": "City offers helpful guides and services.",
          "60": "City grants access to exclusive areas.",
          "80": "City provides free lodging and supplies.",
          "100": "City honors the party as heroes."
        }, descriptors: []}
      ],
      relationships: {
        "Example Faction A": {
          friends: ["Example City"],
          enemies: ["Example Faction B"]
        },
        "Example Faction B": {
          friends: [],
          enemies: ["Example Faction A"]
        },
        "Example City": {
          friends: ["Example Faction A"],
          enemies: ["Example Faction B"]
        }
      }
    };
  }

  //========================================
  // Regional Factions Methods
  //========================================

  loadRegionalData() {
    this.regionalData = game.settings.get('renown-system', 'regionalData');
    if (!this.regionalData || !this.regionalData.regions) {
      this.regionalData = RegionalFactionsManager.getDefaultRegionalData();
      game.settings.set('renown-system', 'regionalData', this.regionalData);
    }
  }

  async saveRegionalData() {
    await game.settings.set('renown-system', 'regionalData', this.regionalData);
    // Broadcast to other players
    if (game.user.isGM) {
      game.socket.emit('module.renown-system', {
        type: 'regionalUpdate',
        regionalData: this.regionalData
      });
    }
  }

  renderRegionalFactions(html) {
    this.loadRegionalData();
    this.loadWorldData();

    const container = html.find('#regionalFactionsContent');
    container.empty();

    const contentHtml = $(`
      <div class="regional-factions-container">
        <div class="regional-factions-header">
          <h2>Regional Power Dynamics</h2>
          <p class="help-text">
            Manage regional authority, faction power distribution, and inter-faction relationships.
            Power in each region is balanced: Faction Power + Authority = 100%
          </p>
        </div>

        <!-- Region Management Section -->
        <div class="section region-management">
          <h3>Region Management</h3>
          <div class="form-row">
            <input type="text" id="new-region-name" placeholder="Enter region name..." />
            <input type="number" id="new-region-authority" min="0" max="100" value="20" placeholder="Authority (0-100)" />
            <button type="button" class="add-region-btn">
              <i class="fas fa-plus"></i> Add Region
            </button>
          </div>
        </div>

        <!-- Faction Assignment Section -->
        <div class="section faction-assignment">
          <h3>Assign Faction to Region</h3>
          <div class="form-row">
            <select id="faction-select-for-region" class="faction-select">
              <option value="">Select Faction...</option>
              ${(this.worldData.factions || []).map(f => `<option value="${f.name}">${f.name}</option>`).join('')}
            </select>
            <select id="region-select-for-faction" class="region-select">
              <option value="">Select Region...</option>
            </select>
            <button type="button" class="assign-faction-btn">
              <i class="fas fa-map-marker-alt"></i> Assign Faction
            </button>
          </div>
          <div class="form-row">
            <input type="text" id="faction-leader" placeholder="Leader (optional)" />
            <input type="text" id="faction-description" placeholder="Description (optional)" />
            <input type="text" id="faction-goals" placeholder="Goals (optional)" />
          </div>
        </div>

        <!-- Interaction Setup Section -->
        <div class="section interaction-setup">
          <h3>Set Faction Interactions</h3>
          <div class="form-row">
            <select id="faction-a-select" class="faction-region-select">
              <option value="">Select Faction A...</option>
            </select>
            <select id="interaction-type-select">
              <option value="war">War (-10 power effect)</option>
              <option value="alliance">Alliance (+5 power effect)</option>
              <option value="trade">Trade Agreement (+3 power effect)</option>
            </select>
            <select id="faction-b-select" class="faction-region-select">
              <option value="">Select Faction B...</option>
            </select>
            <button type="button" class="set-interaction-btn">
              <i class="fas fa-handshake"></i> Set Interaction
            </button>
          </div>
        </div>

        <!-- Regions Display -->
        <div class="regions-display">
          <div class="section-controls">
            <button type="button" class="roll-dice-btn">
              <i class="fas fa-dice"></i> Roll Dice (Simulate Power Changes)
            </button>
            <button type="button" class="export-regional-btn">
              <i class="fas fa-download"></i> Export Regional Data
            </button>
            <button type="button" class="import-regional-btn">
              <i class="fas fa-upload"></i> Import Regional Data
            </button>
            <input type="file" id="import-regional-file" accept=".json" style="display: none;" />
          </div>

          <div id="regions-container" class="regions-grid">
            <!-- Regions will be dynamically rendered here -->
          </div>
        </div>

        <!-- Event Log Section -->
        <div class="section event-log-section">
          <h3>Event Log</h3>
          <div class="event-log-controls">
            <button type="button" class="clear-log-btn">
              <i class="fas fa-trash"></i> Clear Log
            </button>
          </div>
          <div id="event-log" class="event-log">
            <p class="no-events">No events yet. Roll the dice to simulate power changes.</p>
          </div>
        </div>
      </div>
    `);

    container.append(contentHtml);

    // Update region select options
    this.updateRegionSelects(container);

    // Update faction interaction selects
    this.updateFactionInteractionSelects(container);

    // Render regions
    this.renderRegions(container);

    // Attach event handlers
    this.attachRegionalEventHandlers(container);
  }

  updateRegionSelects(container) {
    const regionSelect = container.find('#region-select-for-faction');
    regionSelect.empty();
    regionSelect.append('<option value="">Select Region...</option>');

    for (const regionName in this.regionalData.regions) {
      regionSelect.append(`<option value="${regionName}">${regionName}</option>`);
    }
  }

  updateFactionInteractionSelects(container) {
    const factionASelect = container.find('#faction-a-select');
    const factionBSelect = container.find('#faction-b-select');

    factionASelect.empty();
    factionBSelect.empty();

    factionASelect.append('<option value="">Select Faction A...</option>');
    factionBSelect.append('<option value="">Select Faction B...</option>');

    for (const regionName in this.regionalData.regions) {
      const region = this.regionalData.regions[regionName];
      region.factions.forEach(faction => {
        const optionValue = `${regionName}:${faction.name}`;
        const optionText = `${faction.name} (${regionName})`;
        factionASelect.append(`<option value="${optionValue}">${optionText}</option>`);
        factionBSelect.append(`<option value="${optionValue}">${optionText}</option>`);
      });
    }
  }

  renderRegions(container) {
    const regionsContainer = container.find('#regions-container');
    regionsContainer.empty();

    if (Object.keys(this.regionalData.regions).length === 0) {
      regionsContainer.html('<p style="padding: 20px; text-align: center; opacity: 0.7;">No regions defined. Add a region to get started.</p>');
      return;
    }

    for (const regionName in this.regionalData.regions) {
      const region = this.regionalData.regions[regionName];
      const regionCard = this.createRegionCard(regionName, region);
      regionsContainer.append(regionCard);
    }
  }

  createRegionCard(regionName, region) {
    const factionsList = region.factions.map(faction => {
      const interactionsList = faction.interactions.map(interaction => {
        const interactionClass = `interaction-type-${interaction.type}`;
        return `
          <li class="interaction-item ${interactionClass}">
            <span>${this.regionalFactionsManager.interactions[interaction.type].description} ${interaction.target} (${interaction.region})</span>
            <button type="button" class="remove-interaction-btn" data-region="${regionName}" data-faction="${faction.name}"
                    data-target-region="${interaction.region}" data-target-faction="${interaction.target}">×</button>
          </li>
        `;
      }).join('');

      return `
        <div class="faction-item">
          <div class="faction-item-header">
            <h5>${faction.name}</h5>
            <button type="button" class="remove-faction-btn" data-region="${regionName}" data-faction="${faction.name}">×</button>
          </div>
          <div class="faction-power">
            <div class="power-bar">
              <div class="power-fill" style="width: ${faction.power}%"></div>
              <div class="power-text">${faction.power.toFixed(1)}%</div>
            </div>
          </div>
          <div class="faction-details">
            <p><strong>Leader:</strong> ${faction.leader || 'Unknown'}</p>
            <p><strong>Description:</strong> ${faction.description || 'No description'}</p>
            <p><strong>Goals:</strong> ${faction.goals || 'No goals'}</p>
          </div>
          ${faction.interactions.length > 0 ? `
            <div class="faction-interactions">
              <strong>Interactions:</strong>
              <ul class="interaction-list">
                ${interactionsList}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return $(`
      <div class="region-card">
        <div class="region-header">
          <h4>${regionName}</h4>
          <div class="region-controls">
            <button type="button" class="remove-region-btn" data-region="${regionName}" title="Remove Region">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="authority-control">
          <label>Authority/Lawfulness: <span class="authority-value">${region.authority}%</span></label>
          <input type="range" class="authority-slider" data-region="${regionName}"
                 min="0" max="100" value="${region.authority}" />
          <div class="authority-display">
            Faction Power Available: ${(100 - region.authority).toFixed(0)}%
          </div>
        </div>
        <div class="faction-list">
          ${factionsList.length > 0 ? factionsList : '<p style="opacity: 0.7; font-size: 0.9em;">No factions in this region</p>'}
        </div>
      </div>
    `);
  }

  attachRegionalEventHandlers(container) {
    // Add region button
    container.find('.add-region-btn').on('click', () => {
      const regionName = container.find('#new-region-name').val().trim();
      const authority = parseInt(container.find('#new-region-authority').val()) || 20;

      if (!regionName) {
        ui.notifications.warn('Please enter a region name.');
        return;
      }

      if (this.regionalData.regions[regionName]) {
        ui.notifications.warn('Region already exists.');
        return;
      }

      this.regionalFactionsManager.setRegion(this.regionalData, regionName, authority);
      this.saveRegionalData();
      this.renderRegionalFactions(this.element);
      ui.notifications.info(`Region "${regionName}" added.`);
    });

    // Assign faction button
    container.find('.assign-faction-btn').on('click', () => {
      const factionName = container.find('#faction-select-for-region').val();
      const regionName = container.find('#region-select-for-faction').val();
      const leader = container.find('#faction-leader').val().trim();
      const description = container.find('#faction-description').val().trim();
      const goals = container.find('#faction-goals').val().trim();

      if (!factionName || !regionName) {
        ui.notifications.warn('Please select both a faction and a region.');
        return;
      }

      // Check if faction already exists in this region
      const region = this.regionalData.regions[regionName];
      if (region && region.factions.find(f => f.name === factionName)) {
        ui.notifications.warn('Faction already exists in this region.');
        return;
      }

      this.regionalFactionsManager.addFactionToRegion(this.regionalData, regionName, factionName, {
        leader,
        description,
        goals
      });
      this.saveRegionalData();
      this.renderRegionalFactions(this.element);
      ui.notifications.info(`Faction "${factionName}" assigned to "${regionName}".`);

      // Clear input fields
      container.find('#faction-leader').val('');
      container.find('#faction-description').val('');
      container.find('#faction-goals').val('');
    });

    // Set interaction button
    container.find('.set-interaction-btn').on('click', () => {
      const factionAValue = container.find('#faction-a-select').val();
      const factionBValue = container.find('#faction-b-select').val();
      const interactionType = container.find('#interaction-type-select').val();

      if (!factionAValue || !factionBValue) {
        ui.notifications.warn('Please select both factions.');
        return;
      }

      const [regionA, factionA] = factionAValue.split(':');
      const [regionB, factionB] = factionBValue.split(':');

      if (regionA === regionB && factionA === factionB) {
        ui.notifications.warn('Cannot create interaction with the same faction.');
        return;
      }

      this.regionalFactionsManager.setInteraction(this.regionalData, regionA, factionA, regionB, factionB, interactionType);
      this.saveRegionalData();
      this.renderRegionalFactions(this.element);
      ui.notifications.info(`Interaction set between "${factionA}" and "${factionB}".`);
    });

    // Roll dice button
    container.find('.roll-dice-btn').on('click', () => {
      const logEntries = this.regionalFactionsManager.rollDice(this.regionalData);
      this.saveRegionalData();
      this.renderRegionalFactions(this.element);

      // Display log entries
      const eventLog = container.find('#event-log');
      eventLog.empty();

      if (logEntries.length > 0) {
        logEntries.forEach(entry => {
          eventLog.append(`<div class="event-entry"><span class="event-region">[${entry.region}]</span> ${entry.message}</div>`);
        });
      } else {
        eventLog.html('<p class="no-events">No significant changes occurred.</p>');
      }

      ui.notifications.info('Power dynamics updated!');
    });

    // Clear log button
    container.find('.clear-log-btn').on('click', () => {
      this.regionalFactionsManager.clearEventLog();
      container.find('#event-log').html('<p class="no-events">No events yet. Roll the dice to simulate power changes.</p>');
    });

    // Export regional data button
    container.find('.export-regional-btn').on('click', () => {
      const jsonData = this.regionalFactionsManager.exportData(this.regionalData);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'regional-factions-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ui.notifications.info('Regional data exported!');
    });

    // Import regional data button
    container.find('.import-regional-btn').on('click', () => {
      container.find('#import-regional-file').click();
    });

    container.find('#import-regional-file').on('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = this.regionalFactionsManager.importData(e.target.result);
          if (importedData) {
            this.regionalData = importedData;
            this.saveRegionalData();
            this.renderRegionalFactions(this.element);
            ui.notifications.info('Regional data imported successfully!');
          } else {
            ui.notifications.error('Failed to import regional data. Invalid format.');
          }
        } catch (error) {
          console.error('Import error:', error);
          ui.notifications.error('Error importing regional data.');
        }
      };
      reader.readAsText(file);
    });

    // Authority slider
    container.find('.authority-slider').on('input', (event) => {
      const slider = $(event.currentTarget);
      const regionName = slider.data('region');
      const authority = parseInt(slider.val());

      slider.closest('.authority-control').find('.authority-value').text(`${authority}%`);
      slider.closest('.authority-control').find('.authority-display').html(`Faction Power Available: ${(100 - authority).toFixed(0)}%`);
    });

    container.find('.authority-slider').on('change', (event) => {
      const regionName = $(event.currentTarget).data('region');
      const authority = parseInt($(event.currentTarget).val());

      this.regionalData.regions[regionName].authority = authority;
      this.regionalFactionsManager.balancePower(this.regionalData, regionName);
      this.saveRegionalData();
      this.renderRegionalFactions(this.element);
      ui.notifications.info(`Authority for "${regionName}" updated to ${authority}%.`);
    });

    // Remove region button
    container.find('.remove-region-btn').on('click', (event) => {
      const regionName = $(event.currentTarget).data('region');

      Dialog.confirm({
        title: 'Remove Region',
        content: `<p>Are you sure you want to remove the region "<strong>${regionName}</strong>" and all its factions?</p>`,
        yes: () => {
          this.regionalFactionsManager.removeRegion(this.regionalData, regionName);
          this.saveRegionalData();
          this.renderRegionalFactions(this.element);
          ui.notifications.info(`Region "${regionName}" removed.`);
        },
        no: () => {},
        defaultYes: false
      });
    });

    // Remove faction button
    container.find('.remove-faction-btn').on('click', (event) => {
      const regionName = $(event.currentTarget).data('region');
      const factionName = $(event.currentTarget).data('faction');

      Dialog.confirm({
        title: 'Remove Faction',
        content: `<p>Are you sure you want to remove "<strong>${factionName}</strong>" from "<strong>${regionName}</strong>"?</p>`,
        yes: () => {
          this.regionalFactionsManager.removeFactionFromRegion(this.regionalData, regionName, factionName);
          this.saveRegionalData();
          this.renderRegionalFactions(this.element);
          ui.notifications.info(`Faction "${factionName}" removed from "${regionName}".`);
        },
        no: () => {},
        defaultYes: false
      });
    });

    // Remove interaction button
    container.find('.remove-interaction-btn').on('click', (event) => {
      const regionA = $(event.currentTarget).data('region');
      const factionA = $(event.currentTarget).data('faction');
      const regionB = $(event.currentTarget).data('target-region');
      const factionB = $(event.currentTarget).data('target-faction');

      this.regionalFactionsManager.removeInteraction(this.regionalData, regionA, factionA, regionB, factionB);
      this.saveRegionalData();
      this.renderRegionalFactions(this.element);
      ui.notifications.info('Interaction removed.');
    });
  }
}

// Register the tracker application in Scene Controls (left sidebar)
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

// Also add a menu item for easier access
Hooks.on('getSceneNavigationContext', (html) => {
  if (!game.user.isGM) return;
  
  // Add right-click option on scene navigation
  const renownOption = $(`
    <li class="context-item">
      <i class="fas fa-star"></i> Renown Tracker
    </li>
  `);
  
  renownOption.on('click', () => {
    new RenownTracker().render(true);
  });
  
  // This is a fallback - the scene control button should work
});

// Add keyboard shortcut (optional - press 'R' to open tracker)
Hooks.on('ready', () => {
  if (!game.user.isGM) return;
  
  // Register keyboard shortcut
  document.addEventListener('keydown', (event) => {
    // Press Ctrl+R or Alt+R to open tracker (when not in input field)
    if ((event.ctrlKey || event.altKey) && event.key === 'r' && 
        event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
      new RenownTracker().render(true);
    }
  });
});

