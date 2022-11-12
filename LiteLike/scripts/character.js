"use strict";

import * as UTILS from "./utils.js";

export const roles = UTILS.enumerate("PLAYER", "ENEMY", "CHARACTER", "ITEM");

export const CHARAWEAPONLOADOUT = 5;
export const CHARAITEMLOADOUT = 3;

/**
 * An individual entity within the game
 */
class Entity{
    /**
     * Initializes a new Entity
     * @param {Number} id - The enumerated id of this specific Entity
     * @param {Symbol[]} roles - A list of roles to add to this Entity on creation
     */
    constructor(id, roles){
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
        super(id, roles);
        this.eventlistener = new UTILS.EventListener(Character.EVENTTYPES);

        if(typeof this.getDefaultEventData !== "undefined")this.eventlistener.getDefaultEventData = this.getDefaultEventData;

        for(let prop of ["addEventListener", "removeEventListener", "removeAllListeners", "triggerEvent"]){
            this[prop] = this.eventlistener[prop].bind(this.eventlistener);
        }
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
     * Applies and caps an HP change between 0 and max hp and notifies listeners
     * @param {Number} value - HP Change
     */
    adjustHP(value){
        // Don't do anything if hp hasn't changed
        if(!value) return;
        // get new hp
        let hp = this.statistics.currentHP + value;
        // make sure to bound hp between 0 and hp
        this.statistics.currentHP = Math.max(0,Math.min(hp, this.statistics.hp));
        // Notify listeners that HP has changed
        this.triggerEvent(Character.EVENTTYPES.currentHPchange, {character: this, currentHP: this.statistics.currentHP});
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
        this.statistics = Object.assign({hp: 5, currentHP: 5, vision: 2}, statistics);

        let weapons = [];
        // If there are weapons in equipment, copy the array over
        if(equipment.hasOwnProperty("weapons")) weapons = Array.from(equipment.weapons);

        let armor = null;
        // If there is armor, set the Character's armor to that armor
        if(equipment.hasOwnProperty("armor")) armor = equipment.armor;

        let items = [];
        // If there are items in equipment, copy the array over
        if(equipment.hasOwnProperty("items")) items = Array.from(equipment.items);

        let transport = null;
        // If there is transport, set the Character's transport to that transport
        if(equipment.hasOwnProperty("transport")) transport = equipment.transport;

        let resources = [];
        // If there are items in equipment, copy the array over
        if(equipment.hasOwnProperty("resources")) resources = Array.from(equipment.resources);

        this.equipment = {weapons, armor, items, transport, resources};
    }

    /**
     * Returns a new 
     */
    getCombatCharacter(){
        return new CombatCharacter(this.id, this.roles, this.statistics, this.equipment);
    }
    

    /**
     * Returns the PlayerCharacter's carried weight
     */
    get weight(){
        let weight = 0;
        for(let weapon of this.equipment.weapons) weight+= weapon.weapontype.weight;
        for(let item of this.equipment.items) weight += item.itemtype.weight;
        for(let resource of this.equipment.resources) weight += resource.weight;
        return weight;
    }
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
     */
    constructor(id, roles, statistics, equipment){
        super(id, roles);

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
    }

    /**
     * Returns whether or not the Character's currentHP is less than or equal to 0
     */
    isKOd(){
        return this.statistics.currentHP <= 0;
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
            if(weapon.cooldown.isReady != cooldown) this.triggerEvent(Character.EVENTTYPES.equipmentchange, {type: "weapon", subtype: "timer", item: weapon, timer: "cooldown"});
            if(weapon.warmup.isReady != warmup) this.triggerEvent(Character.EVENTTYPES.equipmentchange, {type: "weapon", subtype: "timer", item: weapon, timer: "warmup"});
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
            if(item.cooldown.isReady != cooldown) this.triggerEvent(Character.EVENTTYPES.itemschange, {type: "item", subtype: "timer", item, timer: "cooldown"});
        }
    }

    /**
     * Returns the first weapon that isAvailable or null if no weapons are available
     * @returns {Weapon | null} - returns the first weapon that isAvailable or null
     */
    firstAvailableWeapon(){
        for(let weapon of this.weapons){
            if(weapon.isAvailable()) return weapon;
        }
    }

    /**
     * Returns the first weapon that isFireable or null if no weapons are Fireable
     * @returns {Weapon | null} - returns the first weapon that isFireable or null
     */
    firstFireableWeapon(){
        for(let weapon of this.weapons){
            if(weapon.isFireable()) return weapon;
        }
    }
}

