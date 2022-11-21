"use strict";

import * as UTILS from "./utils.js";
import {Combat} from "./combat.js";
import * as ITEMS from "./items.js";
import { unlocks } from "./colony.js";
import { createCombatant } from "./io.js";

export const encountertype = UTILS.enumerate("COMBAT","CHOICE", "CALLBACK", "MESSAGE", "REWARD", "NONE");
/**
 * Item Description parameter of various functions
 * @typedef {Object} ItemDescription
 * @property {String} type - Reward Type
 * @property {Number} id - ID for the specific Item or Type
 * @property {Number} qty - Quantity of the item
 */

export class Reward{
    /**
     * Initializes a new Reward Object
     * @param {String} type - The reward type
     * @param {*} reward - The rewarded Object
     */
    constructor(type, reward){
        this.type = type;
        this.reward = reward;
    }
}

export class Choice{
    /**
     * Initializes a new Choice Object
     * @param {*} value - Some value to differentiate this choice from others
     * @param {String} flavor - Message to display on the GUI
     * @param {ItemDescription[]} cost - An array of Item Cost in order to select this choice
     */
    constructor(value, flavor, cost){
        this.value = value;
        this.flavor = flavor;
        this.cost = cost;
    }
}

/**
 * The toplevel container for Encounters. This is the object that gets assigned to
 * GAME.ENCOUNTER and should be used to hold all event types, even if the event is
 * standalone (i.e.- Random Combat Encounters)
 */
export class EncounterSequence{
    /**
     * 
     * @param {Encounter[]} encounters - A list of the encounter objects to progress through
     */
    constructor(encounters){
        this.encounters = Array.from(encounters);
        // Initializing with negative index so that EncounterSequence.increment
        // can always be called
        this.index = -1;
    }

    /**
     * The current encounter
     * @returns The current encounter
     */
    get(){
        return this.encounters[this.index];
    }
    increment(){
        this.index+=1;
        return this.encounters[this.index];
    }
    /**
     * Adds an encounter to the EncounterSequence
     * @param {Encounter} encounter - The encounter to add
     */
    addEncounter(encounter){
        this.encounters.push(encounter);
    }
}

export class Encounter{
    /**
     * Creates a new encounter
     * @param {Symbol} type - an encountertype enumeration
     * @param {Reward[]} reward -  An array of rewards
     * @param {Object} options - Specifications of the encounter; depends on encountertype
     * @param {String} options.exitbutton - The text to display on the exit button
     * @param {Function} options.onexit - Callback to attach to the exit button
     */
    constructor(type, options){
        // Make sure type is a valid encounter type
        if(typeof type === "string") type = encountertype[type];
        if(Object.values(encountertype).indexOf(type) < 0) throw new Error("Invalid Type");
        this.type = type;

        this.options = {...options};
        this.game; 
    }

    initEncounter(game){
        this.game = game;
        return {game, exitbutton: this.options.exitbutton, onexit: this.options.onexit}
    }
}

export class CombatEncounter extends Encounter{
    /**
     * @param {Object} options - Encounter Options
     */
    constructor(options){
        super(encountertype.COMBAT, options);

        // Initialized in initEncounter
        this.combat;
    }
    /**
     * Initializes a new Combat instance using the supplied game and enemy.
     * @param {Game} game - The game object to initialize with. Can be null or undefined if game is assigned in CombatEncounter.options
     * @returns {Combat}- The combat object which is also accessible via this.combat
     */
    initEncounter(game){
        let result = super.initEncounter(game)
        this.combat = new Combat(this.game.PLAYER.getCombatCharacter(), this.options.enemy);
        result.combat = this.combat;
        return result;
    }
}

export class ChoiceEncounter extends Encounter{

    /**
     * @param {Object} options - Encounter Options
     * @param {String} options.message - The Message to display to the user
     * @param {Choice[]} option.choices - Choice for the player to choose between
     * @param {Function} option.callback - A callback to resolve the Player's choice
     */
    constructor(options){
        super(encountertype.CHOICE, options);
    }

    initEncounter(game){
        let result = super.initEncounter(game);
        // We'll need to initialize the cost for each choice
        let choices = [];
        for(let choice of this.options.choices){
            let costs = [];
            for(let cost of choice.cost){
                // Check to see if the cost is already initialized
                if(["Item","Resource"].indexOf(cost.constructor.name) >= 0){
                    // just add it to the list and continue
                    costs.push(cost);
                    continue;
                }
                // Sort out Items and Resources
                if(cost.type == "Item"){
                    // Initialize cost as a Resource
                    let itype = this.game.ITEMS[cost.id];
                    costs.push(new ITEMS.Item(itype, cost.qty));
                }else if(cost.type == "Resource"){
                    // Initialize cost as a Resource
                    let rtype = this.game.RESOUCES[cost.id];
                    costs.push(new ITEMS.Resource(rtype, cost.qty));
                }
            }
            choices.push(new Choice(choice.value, choice.flavor, costs));
        }
        Object.assign(result, {message: this.options.message, callback: this.options.callback, choices});
        return result;
    }
}

export class RewardEncounter extends Encounter{
    /**
     * Initializes a new Reward Encounter
     * @param {Object} options - Encounter Options
     * @param {Reward[]} options.rewards - A list of rewards to give the player
     */
    constructor(options){
        super(encountertype.REWARD, options);
    }

    initEncounter(game){
        let result = super.initEncounter(game);
        result.rewards = [];
        for(let r of this.options.rewards){
            result.rewards.push(parseReward(this.game, r));
        }
        return result;
    }
}

/**
 * An encounter that simply displays text on the player's screen
 */
export class MessageEncounter extends Encounter{
    /**
     * Initializes a new Message Encounter
     * @param {Object} options - Encounter Options
     * @param {String} options.message - The message to display
     */
    constructor(options){
        super(encountertype.MESSAGE, options);
    }
    initEncounter(game){
        let result = super.initEncounter(game);
        result.message = this.options.message;
        return result
    }
}

/**
 * An encounter that displays text on the player's screen
 * and calls a callback when the message is displayed
 */
 export class CallbackEncounter extends MessageEncounter{
    /**
     * Initializes a new Message Encounter
     * @param {Object} options - Encounter Options
     * @param {Function} options.callback - The function to invoke when the message is displayed
     */
    constructor(options){
        super(options);
        // Because MessageEncounter hard-enforces its own type we can't
        // initialize it with our own callback and have to add it later
        this.type = encountertype.CALLBACK
    }
    initEncounter(game){
        let result = super.initEncounter(game);
        result.callback =  this.options.callback
        return result;
    }
}

/**
 * Creates a new Combat Encounter Sequence which is a CombatEncounter followed by a RewardEncounter. Unspecified values are randomized.
 * @param {Game} game - The game object to get statistics from
 * @param {Character | null} enemy - Enemy ID to fight. Null will produce a random tier 1 encounter
 * @param {ItemDescription[] | null} rewards - A list of rewards. Null will produce random tier 1 rewards
 * @param {onext} - The onexit encounter option to use
 * @param {Object} options - Additional options
 * @param {String} options.message - Creates a MessageEvent prior to the CombatEvent
 * @param {Function} options.combatexit - Overrides the onexit for the generated CombatEncounter
 * @param {Function} options.rewardexit - Overrides the onexit for the generated RewardEncounter
 * @param {Function} options.messageexit - Overrides the onexit for the generated MessageEncounter (if that encounter is created)
 * @param {Number} [options.tier=1] - If this is a random encounter and/or has random rewards, this will override the tier
 */
export function buildCombatEncounter(game, enemy, rewards, onexit, options){
    if(!options || typeof options == "undefined") options = {};
    // Establish teir preemptively (this may not be a random encounter)
    // If tier is in options, then use it, otherwise default to 1
    let tier = options.tier && options.tier !== "undefined" ? options.tier : 1;

    // TODO: Random Encounter
    enemy =createCombatant(enemy, game.ENCOUNTERS.combatants, game.ITEMS);
    // Invalid Enemy ID
    if(!enemy || typeof enemy == "undefined") return;
    
    // TODO: Random Rewards
    if(!rewards) return;

    let rewardobjs = []
    for(let reward of rewards){
        let result = parseReward(game, reward);
        if(result) rewardobjs.push(result);
    }

    // Check for overriden onexit for Combat
    let combatexit = onexit;
    if(options.combatexit && typeof options.combatexit !== "undefined") combatexit = options.combatexit;
    // Check for overriden onexit for Reward
    let rewardexit = onexit;
    if(options.rewardexit && typeof options.rewardexit !== "undefined") rewardexit = options.rewardexit;

    let combat = new CombatEncounter({enemy, onexit: combatexit});
    let reward = new RewardEncounter({rewards: rewardobjs, onexit: rewardexit});

    let encounterlist = [combat, reward];

    if(options.message && typeof options.message !== "undefined"){
        // Check for overriden onexit for Message
        let messageexit = onexit;
        if(options.messageexit && typeof options.messageexit !== "undefined") messageexit = options.messageexit;

        let message = new MessageEncounter({message: options.message, onexit: messageexit});
        
        // Insert MessageEncounter at the front of the list
        encounterlist.splice(0,0,message);
    }

    return new EncounterSequence(encounterlist);
}

/**
 * Converts a list of reward description Objects to actual rewards
 * @param {Game} game - The game to use to parse the rewards
 * @param {ItemDescription} reward - A list of rewards
 */
export function parseReward(game, reward){
    // We were passed a reward object, so return it
    if(reward.constructor.name == "Reward") return reward;

    let obj = null;
    // If qty is provided, use it (defaults to 1)
    let qty = reward.qty && reward.qty !== "undefined" ? reward.qty : 1;
    let lookup;

    
    switch(reward.type){
        // Singletons
        case "Unlock":
            lookup = unlocks;
            break;
        // TODO: Include Character Unlocks
        case "Armor":
            lookup = game.ITEMS.armor;
            break;
        case "Transport":
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
    if(["Unlock", "Armor", "Transport", "Map"].indexOf(reward.type) > -1){
        // Return Reward Object
        return new Reward(reward.type, obj);
    }

    // Other things require a little bit more effort
    switch(reward.type){
        case "Item":
            obj = new ITEMS.Item(obj, qty);
            break;
        case "Weapon":
            obj = new ITEMS.Weapon(obj);
            break;
        case "Resource":
            obj = new ITEMS.Resource(obj, qty);
            break;
    }
    
    // Object ready to ship
    return new Reward(reward.type, obj);
}