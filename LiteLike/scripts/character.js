"use strict";

import * as UTILS from "./utils.js";

const roles = UTILS.enumerate("PLAYER", "ENEMY", "CHARACTER", "ITEM");

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
class Character extends Entity{
    /**
     * 
     * @param {Number} id - The enumerated id of this specific Entity
     * @param  {Symbol[]} roles - A list of roles to add to this Entity on creation.
     *                             Character is automatically added.
     * @param {Object} statistics - An object containing combat statistics.
     * @param {Number} statistics.hp - An integer representing the Character's max hp
     * @param {Number} statistics.currenthp - An integer representing the Character's current hp
     * @param {Weapon[]} weapons - An Array of Weapon Objects available for the character
     */
    constructor(id, roles, statistics, weapons){
        this.statistics = statistics;
        this.weapons = Array.from(weapons);
        super(id, roles);
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
    

}

