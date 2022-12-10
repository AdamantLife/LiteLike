"use strict";

import {PlayerCharacter, roles} from "./character.js";
import { TheColony, sectors, unlocks } from "./colony.js";
import {Map} from "./map.js";
import { Encounter, EncounterSequence } from "./encounters.js";
import {GameGUI} from "./gui/game.js";
import { MessageLog } from "./messagelog.js";

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

        // Database of all objets from items.js
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

        // The Message Log
        this.MESSAGELOG = null;

        // The Game's main GUI screen
        this.UI = null;

        // A separate class for handling progression/unlock/upgrade trees/sequences
        this.GAMEPLAYSEQUENCE = null;
    }

    /**
     * Creates the skeletal framework for the Game Interface
     */
    setupUI(){
        this.UI = new GameGUI(this);
        this.UI.setupUI();
        this.COLONY.setupUI();
        this.MESSAGELOG.setupUI();
    }

    /**
     * Initializes all the required objects to start a New Game
     */
    newGame(){
        this.PLAYER = this.startingCharacter();
        this.COLONY = this.initializeColony();
        // When starting a name game, the player/colony starts
        // out with 3 batteries and 10 scrap
        this.COLONY.addResource(1,3);
        this.COLONY.addResource(2,10);
        this.MAP = this.newMap();
        this.MESSAGELOG = new MessageLog(this);
        this.GAMEPLAYSEQUENCE = new GameplaySequence(this);
        this.setupUI();
        this.GAMEPLAYSEQUENCE.newGame();
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

/**
 * A class to implement Gameplay Unlock/Upgrade Trees/Sequences
 */
class GameplaySequence{
    STRINGS = UTILS.enumerate(
        "NEWGAME",
        "FIRSTPOWER",
        "FIRSTPOWER1"
    )
    constructor(game){
        this.game = game;
        this.translate = IO.makeTranslationLookup(this.game, this.STRINGS, "gameplay");
        
        /**
         * The UNLOCKTREE consists of categories of state changes
         * Sector, Unlock, and Resource have Keys that the state
         *      change is compared to
         * The Key's associated value is an Object can contain the following:
         *      * sectors: An Array of Sector enumerations which are automatically added to TheColony.
         *          The sectors key is removed after the Sectors are added to TheColony.
         *      * unlocks: An Array of Unlock enumerations which are automatically unlocked on TheColony
         *          The unlocks key is removed after the Unlocks are unlocked on TheColony.
         *      * callbacks: An Array of Functions which are called with this.Game and the triggering Event as arguments.
         *          If the callback returns true, that callback will be removed from the callbacks Array.
         *          When all callbacks have been removed, the callbacks key will be itself be removed.
         */
        // DEVNOTE- We're defining the Tree directly on the Object so that we can easily
        // remove items from it that have already been achieved
        this.UNLOCKTREE = {
            "sector":{

            },
            "unlock":{
                [unlocks.SECTORS]:{
                    sectors:[sectors.SCRAP]
                }
            },
            "resource":{

            },
        }
        this.initialSetup();

        // GameplaySequence updates its state on a variety of Events
        // Listeners are removed using function references: binding or using
        // arrow functions are unrecoverable, so we need to record those functions separately
        // in order to remove them
        // TODO- Consider changing addEventListener to return a listener id which can be recorder
        //          and subsequently change removeEventListener to take this id instead
        this.listeners = {
            "plm": this.firstPower.bind(this),
            "ua": (event)=>this.checkState(event, "unlock"),
            "sa": (event)=>this.checkState(event, "sector"),
            "r": (event)=>this.checkState(event, "resource")
        };
        this.game.COLONY.addEventListener("powerlevelmodified", this.listeners.plm);
        this.game.COLONY.addEventListener("unlockadded", this.listeners.ua);
        this.game.COLONY.addEventListener("sectoradded", this.listeners.sa);
        this.game.PLAYER.addEventListener("resourcesmodified", this.listeners.r);
    }

    /**
     * Runs through all of the possible flags for the unlock tree to see if they already exist and removes them
     */
    initialSetup(){
        for(let [sector, values] of Object.entries(this.UNLOCKTREE)){}
    }

    /**
     * When the gamestate changes (e.g.- TheColony gets a new unlock), check to see if that change
     * triggers further changes
     * @param {Event} event - Any number of events the Gameplay may be listening for
     * @param {String} type - The UNLOCKTREE type key
     */
    checkState(event, type){
        let lookup = this.UNLOCKTREE[type];
        // We have no more triggers for this eventtype,
        // so make sure eventtype is unregistered and return
        if(typeof lookup == "undefined"|| !lookup || !Object.values(lookup).length) return this.unregisterEvent(event.eventtype);

        // Resource can be multiple resources, so we're going to use an array
        // as default
        let lookupValues = [];
        if(type == "unlock" || type == "sector") lookupValues.push(event[type]);
        else if(type == "resource"){
            for(let [resourceid, qty] of event.resourcechange) lookupValues.push(resourceid);
        }

        for(let lookupValue of lookupValues){
            // All triggers for the lookup
            let triggers = lookup[lookupValue];
            // This type does not have any (remaining) triggers associated with it
            if(!triggers || typeof triggers == "undefined") continue;
            // For each trigger type, handle it

            let sectors = triggers.sectors;
            // This trigger grants some number of sectors to TheColony
            if(sectors && typeof sectors !== "undefined"){
                for(let sector of sectors){
                    // Get the Sector Object from the Game and add it to TheColony
                    this.game.COLONY.addSector(this.game.SECTORS[sector]);
                }
                // Since all sectors were added, remove sectors from the triggers
                delete triggers.sectors;
            }

            let unlocks = triggers.unlocks;
            // This trigger grants some number of unlocks to TheColony
            if(unlocks && typeof unlocks !== "undefined"){
                for(let unlock of unlocks){
                    // Add the unlocks to TheColony
                    this.game.COLONY.unlock(unlock);
                }
                // Since all unlocks were added, remove unlocks from the triggers
                delete triggers.sectors;
            }

            let callbacks = triggers.callbacks;
            // This trigger causes a number of callbacks to be called
            if(callbacks && typeof callbacks !== "undefined"){
                // Make a copy of the list because we're going to
                // be removing successful callbacks
                callbacks = Array.from(callbacks);
                for(let index = 0; index < callbacks.length; index++){
                    // Call the callback with game and event as the arguments
                    let result = callbacks[index](this.game, event);
                    // If the result is successful (true), we can remove this callback from the list
                    if(result) triggers.callbacks.splice(index,1);
                }
                // If we have successfully executed all remaining callbacks,
                // remove callbacks from triggers
                if(!triggers.callbacks.length) delete triggers.callbacks;
            }

            // If no more triggers remain, remove triggers from lookup
            if(!Object.values(triggers).length) delete lookup[lookupValue];
        }
        // Now that we're done removing stuff, check if the lookup is now empty
        // If it is empty, unregister its listener
        if(!Object.values(lookup).length) this.unregisterEvent(event.eventtype);
    }

    /**
     * Determines where the EventListener is registered and what it is registered to,
     * then removes it so it will not be called again.
     * @param {String} eventtype - an Event.eventtype
     */
    unregisterEvent(eventtype){
        let sender, callback;
        switch(eventtype){
            case "unlockadded":
                sender = this.game.COLONY;
                callback = this.listeners.ua;
                break;
            case "sectoradded":
                sender = this.game.COLONY;
                callback = this.listeners.ua;
                break;
            case "equipmentchange":
                sender = this.game.PLAYER;
                callback = this.listeners.r;
                break;
        }
        // No such sender
        // DEVNOTE- As always, should technically raise an Error
        if(!sender) return;
        sender.removeEventListener(eventtype, callback);
    }

    /**
     * When the player starts a new game, display the following message
     */
    newGame(){
        this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.NEWGAME));
    }

    /**
     * When the Player first supplies power to TheColony, grant TheColony the SECTORS 
     */
    firstPower(){
        this.game.COLONY.unlock("SECTORS");
        // There are no other powerlevelmodified unlocks, so remove listener
        this.game.COLONY.removeEventListener("powerlevelmodified", this.listeners.plm);
        this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTPOWER));
        window.setTimeout(()=>{this.game.MESSAGELOG.addMessage(this.translate(this.STRINGS.FIRSTPOWER1));}, 1000);
    }
}

let DEBUGSEED = JSON.parse(`{"i":7,"j":8,"S":[250,210,70,5,116,152,156,50,109,197,228,20,149,6,176,124,151,69,33,148,196,45,94,41,171,90,73,91,218,61,212,206,137,44,213,118,227,38,180,93,15,208,233,145,17,187,11,205,108,78,115,138,77,16,54,87,88,242,39,175,21,128,253,193,10,66,80,129,191,18,29,173,104,142,105,214,161,204,67,71,40,12,133,203,7,107,143,89,254,127,255,144,234,241,100,238,150,60,185,225,140,172,247,216,200,232,1,32,114,113,2,99,24,51,64,9,42,230,201,177,219,123,164,186,14,162,221,52,26,184,163,194,122,220,167,157,68,155,19,166,131,92,53,48,97,125,27,248,146,192,215,55,35,209,74,111,251,47,46,240,243,25,195,207,178,95,139,147,246,49,98,211,119,226,102,183,85,83,189,188,170,63,22,56,252,72,81,4,112,199,202,174,154,223,132,106,120,43,28,76,57,117,229,84,136,30,0,121,23,165,190,126,96,3,245,36,249,168,101,65,135,231,59,244,141,110,34,235,239,58,179,8,198,169,79,82,86,62,130,222,103,159,31,237,236,182,153,134,37,75,158,160,224,181,13,217]}`);
window.GAME = new Game(DEBUGSEED);

{
    /**
     * We sometimes use Symbols as keys, which is valid in ECMA6, but is not supported by many Object functions
     * so we'll be overriding functions we want to use in order to function with Symbols
     */


    function keys(object){
        return [...Object.getOwnPropertyNames(object), ...Object.getOwnPropertySymbols(object)];
    }
    function values(object){
        return Object.keys(object).map(key=>object[key]);
    }
    function entries(object){
        return Object.keys(object).map(key=>[key, object[key]]);
    }
    window.Object.keys = keys;
    window.Object.values = values;
    window.Object.entries = entries;
}