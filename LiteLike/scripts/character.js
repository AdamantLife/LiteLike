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
}

/**
 * A sublcass of Entity which automatically adds the Charater role,
 * and comes with combat statistics
 */
export class Character extends Entity{
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
        // It's arguably more future-proof not to individually pull out statistics
        // and just to copy whole the object over
        this.statistics = Object.assign({}, statistics);

        let weapons = [];
        // If there are weapons in equipment, copy the array over
        if(equipment.hasOwnProperty("weapons")) weapons = Array.from(equipment.weapons);
        this.weapons = weapons;

        let armor = null;
        // If there is armor, set the Character's armor to that armor
        if(equipment.hasOwnProperty("armor")) armor = equipment.armor;
        this.armor = armor;

        super(id, roles);
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

