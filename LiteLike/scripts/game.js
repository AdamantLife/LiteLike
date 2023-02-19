"use strict";

import {PlayerCharacter, roles} from "./character.js";
import { TheColony} from "./colony.js";
import {Map} from "./map.js";
import { Encounter, EncounterSequence, encountertype } from "./encounters.js";
import {GameGUI} from "./gui/game.js";
import { MessageLog } from "./messagelog.js";
import { GameplaySequence } from "./gameplay.js";
import * as ITEMS from "./items.js";

import * as IO from "./io.js";
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
     * Create a new Game instance.
     * This Game instance does not have any Object Data loaded and therefore
     * cannot create gameplay without first calling loadData()
     * 
     * @param {Object} state - A State Object for seedrandom
     * @param {GameplaySequence} [gameplaysequence=GameplaySequence] - A GameplaySequence class to use
     */
    constructor(state, gameplaysequence){
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

        // Database of all objets from items.js
        this.ITEMS = null;

        // Database of all encounters
        this.ENCOUNTERS = null;

        // Master list of Jobs {Object} performed by Meeple on The Colony
        this.JOBS = null;
        // Master list of Sectors {Object} which can be acquired by The Colony
        this.SECTORS = null;

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
        if(!gameplaysequence || typeof gameplaysequence == "undefined") gameplaysequence = GameplaySequence
        this._gameplayclass = gameplaysequence;
        this.GAMEPLAYSEQUENCE = null;
    }
    
    loadData(){
        let completed = new Promise((resolve, fail)=>{
            let calls = 0;
            /** Callback for each async load of the Game constructor.
             *  When all objects are loaded, triggers the Game.loaded event
             */
            function loading(){
                calls += 1;
                for(let value of [this.STRINGS, this.ITEMS, this.ENCOUNTERS, this.JOBS, this.SECTORS]){
                    if(!value || typeof value == "undefined"){
                        if(calls > 4) return fail(game);
                        return;
                    }
                }
                resolve(this);
            }
            
            // Load the current language (default english) then check if we are done loading all data
            IO.loadStrings(this.LANGUAGE)
                .then(result=>{this.STRINGS = result; loading.bind(this)();}) // Store the Language Lookup Object in STRINGS
                .catch(error=> console.log(error));

            // Load the items then check if we are done loading all data
            IO.loadItems()
                .then(result=>{this.ITEMS = result; loading.bind(this)();})
                .catch(error=> console.log(error));

            // Load event data then check if we are done loading all data
            IO.loadEncounters()
                .then(result=>{this.ENCOUNTERS = result; loading.bind(this)();})
                .catch(error=>console.log(error));

            // Load colony-related data then check if we are done loading all data
            IO.loadColony()
                .then(result=>{
                    this.JOBS = result.jobs;
                    this.SECTORS = result.sectors;
                    loading.bind(this)();
                })
                .catch(error=> console.log(error));
        });
        return completed;
    }

    /**
     * Creates a new instance of the given equipment type
     * @param {String | ITEMS.EQUIPMENTTYPE} type - The equipment type to create
     * @param {Number} id - The id of the item to create for the given itemtype
     * @param {Number} [qty = 1] - If the itemtype is a Stackable object, sets the qty to the given number
     * @returns {ITEMS.EQUIPMENTTYPE} - The appropriate instance of the given equipment type
     */
    createEquipmentInstance(type, id, qty = 1){
        // Convert symbols to strings
        if(typeof type == "symbol") type = type.description;

        // Determine class to build and what its type is
        let _class, base;
        switch(type){
            case "ItemType":
            case "Item":
                _class = ITEMS.Item;
                base = this.ITEMS.items[id];
                break;
            case "ResourceType":
            case "Resource":
                _class = ITEMS.Resource;
                base = this.ITEMS.resources[id];
                break;
            case "WeaponType":
            case "Weapon":
                _class = ITEMS.Weapon;
                base = this.ITEMS.weapons[id];
                // Clear qty because this is a weapon
                qty = null;
                break;
        }
        // If type was invalid, just return
        // DEVNOTE- as always, our policy is not to raise errors in this game
        if(typeof _class == "undefined") return;
        
        // Set qty if it is available
        if(qty){
            return new _class(base, qty);
        }
        // Otherwise, don't supply qty
        return new _class(base);
    }

    /**
     * Returns the Job with the given id
     * @param {Number} id - The id of the desired job
     */
    getJobById(id){
        // DEVNOTE- technically JOBS[id] should be accurate,
        //      but we don't technically enforce that behavior
        for(let job of this.JOBS){
            if(job.id == id) return job;
        }
    }

    /**
     * Initializes the main menu
     * @param {Function} demos- Additional code to setup a demos submenu
     */
    setupUI(demos){
        this.UI = new GameGUI(this, demos);
    }

    /**
     * Creates the skeletal framework for the Game Interface
     */
    setupGameplayUI(){
        this.COLONY.setupUI();
        this.MESSAGELOG.setupUI();
        this.MAP.setupUI();
    }

    /**
     * Initializes all the required objects to start a New Game
     */
    newGame(){
        for(let sector of Object.values(this.SECTORS)) sector.level = 0;
        this.PLAYER = this.startingCharacter();
        this.COLONY = this.initializeColony();
        // When starting a name game, the player/colony starts
        // out with 3 batteries and 10 scrap
        this.COLONY.addResource(1,3);
        this.COLONY.addResource(2,10);
        this.MAP = this.newMap(this, this.random(), true);
        this.MESSAGELOG = new MessageLog(this);
        this.GAMEPLAYSEQUENCE = new this._gameplayclass(this);
        this.setupGameplayUI();
        // Using the default GameplaySequence, displays an inital message in the MessageLog
        this.GAMEPLAYSEQUENCE.newGame();
    }

    exitGame(){
        if(this.ENCOUNTER && this.ENCOUNTER.get()){
            let encounter = this.ENCOUNTER.get();
            // DEVNOTE- atm CombatEncounter is the only Encounter type that has listeners
            //      and/or a loop attached to it that have to be cleared

            // Calling resolveCombat will notify listeners that combat is over,
            // stop the loop, and clear listeners on enemy and Combat
            // DEVNOTE- We have not implemented any exit checks within combatLoop,
            //      so it will continue to execute until it reaches the end
            if(encounter.type == encountertype.COMBAT) encounter.instance.resolveCombat();
        }
        // Remove Player Listeners
        this.PLAYER.removeAllListeners();
        // Stop the Map Loop
        this.MAP.clearLoop();
        // Remove Map listners
        this.MAP.removeAllListeners();
        // Stop the colony loop
        this.COLONY.clearLoop();
        // Remove Colony Listeners
        this.COLONY.removeAllListeners();
        // Stop Gameplay Event Callback
        this.GAMEPLAYSEQUENCE.cancelNextColonyTimeout();
        // Remove all our listeners
        this.removeAllListeners();

        // Clear all Gameplay Objects
        this.ENCOUNTER = null;
        this.PLAYER = null;
        this.COLONY = null;
        this.MAP = null;
        this.GAMEPLAYSEQUENCE = null;
        this.MESSAGELOG = null;
    }

    /**
     * Returns a starting player character
     */
     startingCharacter(){
        let player = new PlayerCharacter(0, [roles.CHARACTER, roles.PLAYER], this,
            {hp:5, currentHP: 5},
            {
                weapons: null,
                armor:null,
                transport:null,
                items: null,
                resources: null
            });
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