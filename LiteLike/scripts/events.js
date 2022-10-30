import * as UTILS from "./utils.js";
import {Combat} from "./combat.js";

const encountertype = UTILS.enumerate("combat","choice", "none");
const reward = UTILS.enumerate("item", "unlock" , "map" );

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
    constructor(){
        super();
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