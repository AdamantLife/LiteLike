"use strict";

import {PlayerCharacter, roles} from "./character.js";
import { TheColony } from "./colony.js";
import {Map} from "./map.js";
import { Encounter, EncounterSequence } from "./encounters.js";

import * as IO from "./io.js";
import * as EQUIP from "./items.js";
import * as UTILS from "./utils.js";


export class Game extends UTILS.EventListener{
    static EVENTTYPES = UTILS.enumerate(
        "encountersequenceadded", "encountersequenceremoved",
        "encounterstart", "encounterend",
        // This is implemented for the edge case in which listeners need
        // to be notified that the current EncounterSequence is no longer
        // active, but has not been formally removed from the Game
        "noencounter",
        // The encounter has completed initialization after being started
        "encounterinitialized"
        // TODO: ? Maybe add Player/Colony Added events?
    );
    /**
     * Create a new Game instance
     * @param {Object} state - A State Object for seedrandom
     */
    constructor(state){
        super(Game.EVENTTYPES);
        // If state is provided for the RNG, use it
        if(typeof state !== "undefined"){
            this.random = new Math.seedrandom("", {state});
        }else{ // Otherwise, generate a new state-full RNG
            this.random = new Math.seedrandom(Math.random(), {state:true});
        }
        
        // Default language is english
        this.LANGUAGE = "english";
        // Strings will store an Object that we can lookup
        // text to display in the current language
        this.STRINGS = null;

        // Load the default language (english)
        IO.loadStrings(this.LANGUAGE)
            .then(result=>{this.STRINGS = result;}) // Store the Language Lookup Object in STRINGS
            .catch(error=> console.log(error));

        // Database of all items
        this.ITEMS = null;
        // Load the items
        IO.loadItems()
            .then(result=>{this.ITEMS = result;})
            .catch(error=> console.log(error));

        // Database of all encounters
        this.ENCOUNTERS;
        // Load event data
        IO.loadEncounters()
            .then(result=>{this.ENCOUNTERS = result;})
            .catch(error=>console.log(error));

        this.JOBS = null;
        this.SECTORS = null;
        IO.loadColony()
            .then(result=>{this.JOBS = result.jobs; this.SECTORS = result.sectors;})
            .catch(error=> console.log(error));

        // Player Character
        this.PLAYER = null;

        // The Colony
        this.COLONY = null;

        // Current Map
        this.MAP = null;

        // Current ENCOUNTER
        this.ENCOUNTER = null;
    }

    /**
     * Returns a starting player character
     */
     startingCharacter(){
        let player = new PlayerCharacter(0, [roles.CHARACTER, roles.PLAYER],
            {hp:5, currentHP: 5},
            {
                weapons: [new EQUIP.Weapon(this.ITEMS.weapons[0])],
                armor:this.ITEMS.armor[0],
                transport: this.ITEMS.transports[0],
                items:[new EQUIP.Item(this.ITEMS.items[0], 1)]
            });
        // Because transports are singletons, we need to reset its reactorPower
        player.equipment.transport.topOff();
        return player;
    }

    initializeColony(){
        return new TheColony(this, 0);
    }

    newMap(seed, mask){
        if(!seed || typeof seed === "undefined") seed = this.random();
        return new Map(seed, mask, this.PLAYER);
    }

    /**
     * Checks if the Game is currently in an EncounterSequence.
     * If it is, adds the Encounter to the end of the Sequence.
     * Otherwise, creates a new EncounterSequence with the given Encounter
     * and sets it via this.setEncounter
     * @param {Encounter} encounter - The encounter to add
     * @returns {EncounterSequence} - The Game's current EncounterSequence
     */
    getOrAddEncounter(encounter){
        if(!this.ENCOUNTER){
            let sequence = new EncounterSequence([encounter,]);
            this.setEncounter(sequence);
        }else{
            this.ENCOUNTER.addEncounter(encounter)
        }
        return this.ENCOUNTER;
    }


    /**
     * Sets the given encounterSequence as this.ENCOUNTER and triggers the encountersequenceadded callback
     * @param {EncounterSequence} encounterSequence - The EncounterSequence to add
     */
    setEncounter(encounterSequence){
        this.ENCOUNTER = encounterSequence;
        this.triggerEvent(Game.EVENTTYPES.encountersequenceadded, {sequence: this.ENCOUNTER});
    }

    /**
     * Clears the current EncounterSequence and notifies listeners
     */
    clearEncounter(){
        // There is no encounter, so ignore
        if(!this.ENCOUNTER) return;
        // Keep a record of the sequence so we can provide it to the callback
        let sequence = this.ENCOUNTER;
        // Clear our current Sequence
        this.ENCOUNTER = null;
        // Notify listeners
        this.triggerEvent(Game.EVENTTYPES.encountersequenceremoved, {sequence});
    }

    /**
     * Increments the current EncounterSequence
     * If the sequence has a new Encounter, encounterstart will be triggered
     * Othwerise, if autoRemove it true, this.ENCOUNTERS will be cleared and
     *      encountersequenceremoved will be triggered
     * If autoRemove is false (and no new Encounter), then the noencounter Event will be triggered
     * @param {Boolean} [autoRemove = false] - Whether or not to remove an
     *          EncounterSequence if it does not have any more Encounters. Defaults to false.
     */
    cycleEncounter(autoRemove = false){
        if(!this.ENCOUNTER) return;
        // Notify listeners that we are ending/clearing the current Encounter
        this.triggerEvent(Game.EVENTTYPES.encounterend, {sequence: this.ENCOUNTER, encounter: this.ENCOUNTER.get()});

        let encounter = this.ENCOUNTER.increment();
        // There is a new encounter afterthe increment, so notify listeners that it has been loaded
        if(encounter){
            this.triggerEvent(Game.EVENTTYPES.encounterstart, {sequence: this.ENCOUNTER, encounter});
        // We have reached the end of the Sequence and autoRemove is true, so notify listeners
        // that we are clearing the EncounterSequence
        }else if(autoRemove){
            this.ENCOUNTER = null;
            this.triggerEvent(Game.EVENTTYPES.encountersequenceremoved, {sequence: this.ENCOUNTER});
        // End of the Sequence but we are not clearing the Sequence, so let listeners know
        }else{
            this.triggerEvent(Game.EVENTTYPES.noencounter, {sequence: this.ENCOUNTER});
        }
    }
}

window.GAME = new Game(JSON.parse(`{"i":7,"j":8,"S":[250,210,70,5,116,152,156,50,109,197,228,20,149,6,176,124,151,69,33,148,196,45,94,41,171,90,73,91,218,61,212,206,137,44,213,118,227,38,180,93,15,208,233,145,17,187,11,205,108,78,115,138,77,16,54,87,88,242,39,175,21,128,253,193,10,66,80,129,191,18,29,173,104,142,105,214,161,204,67,71,40,12,133,203,7,107,143,89,254,127,255,144,234,241,100,238,150,60,185,225,140,172,247,216,200,232,1,32,114,113,2,99,24,51,64,9,42,230,201,177,219,123,164,186,14,162,221,52,26,184,163,194,122,220,167,157,68,155,19,166,131,92,53,48,97,125,27,248,146,192,215,55,35,209,74,111,251,47,46,240,243,25,195,207,178,95,139,147,246,49,98,211,119,226,102,183,85,83,189,188,170,63,22,56,252,72,81,4,112,199,202,174,154,223,132,106,120,43,28,76,57,117,229,84,136,30,0,121,23,165,190,126,96,3,245,36,249,168,101,65,135,231,59,244,141,110,34,235,239,58,179,8,198,169,79,82,86,62,130,222,103,159,31,237,236,182,153,134,37,75,158,160,224,181,13,217]}`));