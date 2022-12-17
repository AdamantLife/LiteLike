"use strict";

import * as UTILS from "./utils.js";

export const roles = UTILS.enumerate("PLAYER", "ENEMY", "CHARACTER", "ITEM");

export const CHARAWEAPONLOADOUT = 5;
export const CHARAITEMLOADOUT = 3;

/**
 * An individual entity within the game
 */
class Entity extends UTILS.EventListener{
    /**
     * Initializes a new Entity
     * @param {Number} id - The enumerated id of this specific Entity
     * @param {Symbol[]} roles - A list of roles to add to this Entity on creation
     */
    constructor(events,id, roles){
        super(events);
        this.id = id;
        this._roles = [];
        for(let role of roles)this.addRole(role);
    }
    
    /**
     * Adds a role to the entity if the role does not already exist
     * @param {Symbol} role - Adds a new role to the Entity
     */
    addRole(role){
        if(this._roles.indexOf(role) < 0) this._roles.push(role);
    }

    get roles(){
        return this._roles;
    }
}

/**
 * A workaround to implment multiple inheritances for Characters 
 * which should extend both Entity and EventListener
 */
export class Character extends Entity{
    static EVENTTYPES = UTILS.enumerate("equipmentchange", "itemschange", "resourceschange", "hpchange", "currentHPchange");
    constructor(id, roles){
        super(Character.EVENTTYPES, id, roles);
    }

    /**
     * ALl character events should return the given data at minimum
     * @returns {Object} - The default event data
     */
    getDefaultEventData(){
        // Just in case Character changes in the future, make sure we're getting all parent data
        let base = super.getDefaultEventData();
        // Update with the data we want
        Object.assign(base, {character: this})
        // Return the base (which has been updated in place)
        return base;
    }

    /**
     * Given a weapon id, return the index of the first weapon with that id.
     * Return -1 if a matching weapon is not found
     * @param {Number} weapon - The weapon id to get
     * @returns {Number | -1} - The index of the matching weapon, or -1 if player doesn't have that weapontype
     */
    getWeaponIndex(weapon){
        // Iterate over all weapons
        let weap;
        for(let i = 0; i < this.weapons.length; i++){
            weap = this.weapons[i]
            // A weapon exists at this index
            if(weap && typeof weap !== "undefined"
                // and its weapontype id matches what we are looking for
                && weap.weapontype.id  == weapon) return i;
        }

        // We didn't match, so return -1
        return -1;
    }

    /**
     * Returns the first weapon with the given weapon id, or null if none are found
     * @param {Number} weapon - The weapon id to get
     * @returns {Weapon | null} - Returns the weapon if they player has it, otherwise none
     */
    getWeapon(weapon){
        // Iterate over weapons
        for(let weap of this.weapons){
            // If weapon id matches, return it
            if (weap.weapontype.id == weapon){
                return weap;
            }
        }
        // Null will be returned implicitly
    }

    /**
     * Returns the index of the item with the given item id in the player's equipment
     * @param {Number} item - The Item id
     * @returns {Number} - Returns the equipment index of the item, or -1 if the player does not possess the item
     */
    getItemIndex(item){
        // Iterate over items to find the item
        for(let i = 0; i < this.items.length; i++){
            // Check if itemid is the one we're looking for
            // Return the current index if it is
            if(this.items[i].itemtype.id == item) return i;
        }

        // Item not found, so return -1
        return -1;
    }

    /**
     * Checks the character's items list for the given item and returns it if the character has it
     * @param {Number} item - The item id to get
     * @param {Boolean} returnEmpty- A boolean to indicating whether to return an empty item
     * @returns {Item | null} - Returns the item if the player has it in non-zero quantity, otherwise null
     */
    getItem(item, returnEmpty = false){
        // Items are unsorted, so we'll have to dig through the whole backpack
        for(let it of this.items){
            // If itemtype matches, return the Item Instance
            if(it.itemtype.id == item){
                // If returnEmpty is false and we don't have any
                // return null instead of the  item
                if(it.quantity <= 0 && !returnEmpty) return null;
                // Return the item
                return it;
            }
        }
        // At this point, we did not find it, so null will be returned implicitly
    }

    /**
     * Returns the given resource if the Player has a positive quantity of it
     * @param {Number} resource - The resource ID to return
     * @param {Boolean} returnEmpty- A boolean to indicating whether to return an empty resource
     * @returns {Resource | null} - 
     */
    getResource(resource, returnEmpty = false){
        // Resources are sorted, so we can just get the corresponding index
        let r = this.resources[resource];
        // If the resources is not in our resources array, return null
        // Also return null if we don't have any quantity of the resource and we're not supposed to returnEmpty
        if(!r || typeof r == "undefined" || (r.quantity <= 0 && returnEmpty)) return null;

        // Otherwise, return it
        return r;
    }

    /**
     * Adds an item to the Character's equipment. If the character already
     * has the item, increases its quantity instead
     * @param {Item} item - The item to be added
     */
    addItem(item){
        // Check if we already have it
        let existing = this.getItem(item.itemtype.id, true);
        // Just add it if we don't have it
        if(!existing) return this.items.push(item);
        // Otherwise, we need to update our item
        existing.quantity += item.quantity;
    }

    /**
     * Adds a resource to the Character's equipment. If the character already
     * has the resource, increases its quantity instead
     * @param {Resource} resource - The resource to be added
     */
     addResource(resource){
        // Check if we already have it
        let existing = this.getResource(resource.resourcetype.id, true);
        // Just add it if we don't have it
        if(!existing) return this.resources[resource.resourcetype.id] = resource;
        // Otherwise, we need to update our item
        existing.quantity += resource.quantity;
    }

    /**
     * Applies and caps an HP change between 0 and max hp and notifies listeners
     * @param {Number} value - HP Change
     */
    adjustHP(value){
        // Don't do anything if hp hasn't changed
        if(!value) return;
        // Need initial hp to put in the event
        let initialHP = this.statistics.currentHP;
        // get new hp
        let hp = this.statistics.currentHP + value;
        // make sure to bound hp between 0 and hp
        this.statistics.currentHP = Math.max(0,Math.min(hp, this.statistics.hp));
        // Notify listeners that HP has changed
        this.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this, currentHP: this.statistics.currentHP, initialHP, rawchange: value});
    }

    /**
     * Sets the Character's currentHP to the given amount (max the Character's hp stat) and notify listeners.
     * If there is no change in HP, listeners will not be notified.
     * @param {Number} value - The HP to set to
     */
    setHP(value){
        // Track change
        let initialHP = this.statistics.currentHP;
        // Set to max of stat.hp
        this.statistics.currentHP = Math.min(value, this.statistics.hp);
        // if change did not occur, exit early
        if(initialHP == this.statistics.currentHP) return;
        // Otherwise, notify listeners
        this.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this, currentHP: this.statistics.currentHP, initialHP, setvalue: value});
    }

    /**
     * Returns whether or not the Character's currentHP is less than or equal to 0
     */
     isKOd(){
        return this.statistics.currentHP <= 0;
    }
}

/**
 * The Player Character's entity which has additional functionality
 */
export class PlayerCharacter extends Character{
    /**
     * 
     * @param {Number} id - The enumerated id of this specific Entity
     * @param  {Symbol[]} roles - A list of roles to add to this Entity on creation.
     *                             Character is automatically added.
     * @param {Object} statistics - An object containing statistics.
     * @param {Number} statistics.hp - An integer representing the Character's max hp
     * @param {Number} statistics.currentHP - An integer representing the Character's current hp
     * @param {Number} statistics.vision - An integer representing the number of squares
     *                                      the Character can see on the Map
     * @param {Object}   equipment - An object containing equipment for the character
     * @param {Weapon[]} equipment.weapons - An Array of Weapon Objects available for the character
     * @param {Armor}    equipment.armor - An Armor object
     * @param {Item[]}   equipment.items - An Array of Item Objects owned by the character
     * @param {Resource[]}   equipment.resources - An Array of Resource Objects owned by the character
     */
    constructor(id, roles, statistics, equipment){
        super(id, roles);

        // It's arguably more future-proof not to individually pull out statistics
        // and just to copy whole the object over
        // Including some default stats
        this.statistics = Object.assign({hp: 5, currentHP: 5, vision: 3}, statistics);

        let weapons = [];
        // If there are weapons in equipment, copy the array over
        if(equipment.hasOwnProperty("weapons") && equipment.weapons) weapons = Array.from(equipment.weapons);

        let armor = null;
        // If there is armor, set the Character's armor to that armor
        if(equipment.hasOwnProperty("armor") && equipment.armor) armor = equipment.armor;

        let items = [];
        // If there are items in equipment, copy the array over
        if(equipment.hasOwnProperty("items") && equipment.items) items = Array.from(equipment.items);

        let transport = null;
        // If there is transport, set the Character's transport to that transport
        if(equipment.hasOwnProperty("transport") && equipment.transport) transport = equipment.transport;

        let resources = [];
        // If there are items in equipment, copy the array over
        if(equipment.hasOwnProperty("resources") && equipment.resources) resources = Array.from(equipment.resources);

        this.equipment = {weapons, armor, items, transport, resources};
    }

    /**
     * Returns a new 
     */
    getCombatCharacter(){
        return new CombatCharacter(this.id, this.roles, this.statistics, this.equipment, this);
    }
    

    /**
     * Returns the PlayerCharacter's carried weight
     */
    get weight(){
        let weight = 0;
        for(let weapon of this.equipment.weapons) weight+= weapon.weapontype.weight;
        for(let item of this.equipment.items) weight += item.totalWeight;
        for(let resource of Object.values(this.equipment.resources)) weight += resource.totalWeight;
        return weight;
    }

    get weapons(){return this.equipment.weapons;}
    get items(){ return this.equipment.items;}
    get resources(){ return this.equipment.resources;}
    get transport(){ return this.equipment.transport;}
    get armor(){ return this.equipment.armor;}
}

/**
 * A sublcass of Entity which comes with combat statistics and functions
 */
export class CombatCharacter extends Character{
    /**
     * 
     * @param {Number} id - The enumerated id of this specific Entity
     * @param  {Symbol[]} roles - A list of roles to add to this Entity on creation.
     *                             Character is automatically added.
     * @param {Object} statistics - An object containing combat statistics.
     * @param {Number} statistics.hp - An integer representing the Character's max hp
     * @param {Number} statistics.currentHP - An integer representing the Character's current hp
     * @param {Object}   equipment - An object containing equipment for the character
     * @param {Weapon[]} equipment.weapons - An Array of Weapon Objects available for the character
     * @param {Armor}    equipment.armor - An Armor object
     * @param {Item[]}   equipment.items - An Array of Item Objects owned by the character
     * @param {Resource[]} equipment.resources - An Array of Resource Objects owned by the character
     */
    constructor(id, roles, statistics, equipment, character){
        super(id, roles);
        // If this character was built off of another character (e.g.- The Player Character)
        // save a backreference to it
        this.character = character;

        this.statistics = statistics;

        let weapons = [];
        // If there are weapons in equipment, use that value
        if(equipment.hasOwnProperty("weapons")) weapons = equipment.weapons;
        this.weapons = weapons;

        let armor = null;
        // If there is armor, set the Character's armor to that armor
        if(equipment.hasOwnProperty("armor")) armor = equipment.armor;
        this.armor = armor;

        let items = [];
        // If there are items in equipment, use that value
        if(equipment.hasOwnProperty("items")) items = equipment.items;
        this.items = items;

        let resources = [];
        // If there are items in equipment, use that value
        if(equipment.hasOwnProperty("resources")) resources = equipment.resources;
        this.resources = resources;
    }

    /**
     * Returns a random weapon
     * @param {*} random - A random number generator (optional)
     * @returns {Weapon | null} - Returns a random weapon from this
     *                              Character's weapons, or null if it has none
     */
    randomWeapon(random){
        if(!this.weapons.length) return null;
        if(typeof random == "undefined") random = Math.random;
        return UTILS.randomChoice(this.weapons, random);        
    }

    /**
     * Calls updateTimers on the Character's weapon loadout
     * @param {Number} now- Performance.now
     */
    updateWeapons(now){
        for(let weapon of this.weapons.slice(0,CHARAWEAPONLOADOUT)){
            let cooldown = weapon.cooldown.isReady;
            let warmup = weapon.warmup.isReady;
            weapon.updateTimers(now);
            if(weapon.cooldown.isReady != cooldown) this.triggerEvent(Character.EVENTTYPES.equipmentchange, {subtype: "timer", item: weapon, timer: "cooldown"});
            if(weapon.warmup.isReady != warmup) this.triggerEvent(Character.EVENTTYPES.equipmentchange, {subtype: "timer", item: weapon, timer: "warmup"});
        }
    }

    /**
     * Calls updateTimer on the Character's item loadout
     * @param {Number} now - Performance.now
     */
    updateItems(now){
        for(let item of this.items.slice(0,CHARAITEMLOADOUT)){
            let cooldown = item.cooldown.isReady;
            item.updateTimer(now);
            if(item.cooldown.isReady != cooldown) this.triggerEvent(Character.EVENTTYPES.itemschange, {subtype: "timer", item, timer: "cooldown"});
        }
    }

    /**
     * Returns the first weapon that isAvailable or null if no weapons are available
     * @returns {Weapon | null} - returns the first weapon that isAvailable or null
     */
    firstAvailableWeapon(){
        for(let weapon of this.weapons){
            if(weapon.isAvailable(this)) return weapon;
        }
    }

    /**
     * Returns the first weapon that isFireable or null if no weapons are Fireable
     * @returns {Weapon | null} - returns the first weapon that isFireable or null
     */
    firstFireableWeapon(){
        for(let weapon of this.weapons){
            if(weapon.isFireable(this)) return weapon;
        }
    }
}

