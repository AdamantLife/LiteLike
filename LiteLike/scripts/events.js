"use strict";

import * as UTILS from "./utils.js";
import {Combat} from "./combat.js";
import * as ITEMS from "./items.js";
import { unlocks } from "./colony.js";

export const encountertype = UTILS.enumerate("combat","choice", "none");
export const reward = UTILS.enumerate("item", "unlock" , "map" );

/**
 * Reward Description parameter of various functions
 * @typedef {Object} RewardDescription
 * @property {String} type - Reward Type
 * @property {Number} id - ID for the specific Item or Type
 * @property {Number} qty - Quantity of the item
 */

class Reward{
    /**
     * Initializes a new Reward Object
     * @param {String} type - The reward type
     * @param {*} reward - The rewarded Object
     */
    constructor(type, reward){

    }
}

export class Encounter{
    /**
     * Creates a new encounter
     * @param {Symbol} type - an encountertype enumeration
     * @param {Object[]} reward -  An array of rewards
     * @param {Symbol}  reward[].type - a reward enumeration
     * @param {*}       reward[].value - the value of the reward
     * @param {*} options - Specifications of the encounter; depends on encountertype
     */
    constructor(type, reward, options){
        // Make sure type is a valid encounter type
        if(typeof type === "string") type = encountertype[type];
        if(Object.values(encountertype).indexOf(type) < 0) throw new Error("Invalid Type");
        this.type = type;

        this.reward = reward;
        this.options = {...options};
        this.game; 
    }
}

export class CombatEncounter extends Encounter{
    constructor(type, reward, options){
        super(type, reward, options);
        this.combat;
    }
    initEncounter(game){
        this.game = game;
        this.combat = new Combat(this.game.PLAYER, this.options.enemy);
        return this.combat;
    }
}

export class ChoiceEncounter extends Encounter{
    initEncounter(){
        return {flavor: this.options.flavor, choices: this.options.choices};
    }
}

export class EncounterSequence{
    constructor(encounters){
        this.encounters = Array.from(encounters);
        this.index = 0;
    }

    /**
     * The current encounter
     * @returns The current encounter
     */
    get(){
        return this.encounters[this.index];
    }
    increment(){
        this.index+=0;
        return this.encounters[this.index];
    }
}

/**
 * Creates a new Combat Encounter. Unspecified values are randomized.
 * @param {Game} game - The game object to get statistics from
 * @param {Character | null} enemy - Enemy ID to fight. Null will produce a random tier 1 encounter
 * @param {RewardDescription[] | null} rewards - A list of rewards. Null will produce random tier 1 rewards
 * @param {Number} options.tier - If this is a random encounter and/or has random rewards, this will override the tier
 */
export function buildCombatEncounter(game, enemy, rewards, options){
    // Establish teir preemptively (this may not be a random encounter)
    // If tier is in options, then use it, otherwise default to 1
    let tier = options.tier && options.tier !== "undefined" ? options.tier : 1;

    // TODO: Random Encounter
    if(!enemy) return;

    // Get enemy with the given enemy id
    enemy = game.EVENTS.combatants[enemy];

    // TODO: Random Rewards
    if(!rewards) return;

    rewards = parseRewards(game, rewards)
}

/**
 * Converts a list of reward description Objects to actual rewards
 * @param {Game} game - The game to use to parse the rewards
 * @param {RewardDescription[]} rewards - A list of rewards
 */
export function parseRewards(game, rewards){
    for(let reward of rewards){
        obj = null;
        // If qty is provided, use it (defaults to 1)
        qty = reward.qty && reward.qty !== "undefined" ? reward.qty : 1;
        let lookup;

        
        switch(reward.type){
            // Singletons
            case "unlock":
                lookup = unlocks;
                break;
            case "armor":
                lookup = game.ITEMS.armor;
                break;
            case "transport":
                lookup = game.ITEMS.transports;
                break;
            // TODO: add Map Reward

            // Others
            case "Item":
                lookup = game.ITEMS.items;
                break;
            case "Weapon":
                lookup = game.ITEMS.weapons;
                break;
            case "Resource":
                lookup = game.ITEMS.resources;
                break;
            }

        // We don't know what this is
        if(!lookup) return;

        // Make sure reward id is valid
        obj = lookup[reward.id] && typeof lookup[reward.id] !== "undefined" ? lookup[reward.id] : null;
        // If reward id is not valid, don't return a reward
        if(!obj) return;

        // We can return Singletons immediately
        if(["unlock", "armor", "transport", "map"].indexOf(reward.type) > -1){
            // Return Reward Object
            return new Reward(reward.type, obj);
        }

        // Other things require a little bit more effort
        switch(reward.type){
            case "Item":
                obj = ITEMS.Item(obj, qty);
                break;
            case "Weapon":
                obj = ITEMS.Weapon(obj);
                break;
            case "Resource":
                obj = ITEMS.Resource(obj, qty);
                break;
        }
        
        // Object ready to ship
        return new Reward(reward.type, obj);
    }
}