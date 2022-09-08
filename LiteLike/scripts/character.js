"use strict";

import * as UTILS from "./utils.js";

export const roles = UTILS.enumerate("PLAYER", "ENEMY", "CHARACTER", "ITEM");

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
 * The Player Character's entity which has additional functionality
 */
export class PlayerCharacter extends Entity{
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
export class CombatCharacter extends Entity{
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
     * Calls updateState on all weapons in the Player's inventory
     */
    updateWeapons(){
        for(let weapon of this.weapons){
            weapon.updateState();
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

