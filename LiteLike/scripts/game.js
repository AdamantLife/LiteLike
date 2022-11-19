"use strict";

import {PlayerCharacter, roles} from "./character.js";
import { TheColony } from "./colony.js";
import {Map} from "./map.js";

import * as EVENTS from "./events.js";
import * as IO from "./io.js";
import * as EQUIP from "./items.js";


export class Game{
    /**
     * Create a new Game instance
     * @param {Object} state - A State Object for seedrandom
     */
    constructor(state){
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
        // Database of all events (requires self.ITEMS to intialize)
        this.EVENTS;
        // Load the items
        IO.loadItems()
            .then(result=>{this.ITEMS = result;})
            .catch(error=> console.log(error));

        // Load event data
        IO.loadEvents()
            .then(result=>{this.EVENTS = result;})
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

        // Current EVENT
        this.EVENT = null;

        // Current Combat being executed (if any)
        this.COMBAT = null;
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
}

window.GAME = new Game(JSON.parse(`{"i":7,"j":8,"S":[250,210,70,5,116,152,156,50,109,197,228,20,149,6,176,124,151,69,33,148,196,45,94,41,171,90,73,91,218,61,212,206,137,44,213,118,227,38,180,93,15,208,233,145,17,187,11,205,108,78,115,138,77,16,54,87,88,242,39,175,21,128,253,193,10,66,80,129,191,18,29,173,104,142,105,214,161,204,67,71,40,12,133,203,7,107,143,89,254,127,255,144,234,241,100,238,150,60,185,225,140,172,247,216,200,232,1,32,114,113,2,99,24,51,64,9,42,230,201,177,219,123,164,186,14,162,221,52,26,184,163,194,122,220,167,157,68,155,19,166,131,92,53,48,97,125,27,248,146,192,215,55,35,209,74,111,251,47,46,240,243,25,195,207,178,95,139,147,246,49,98,211,119,226,102,183,85,83,189,188,170,63,22,56,252,72,81,4,112,199,202,174,154,223,132,106,120,43,28,76,57,117,229,84,136,30,0,121,23,165,190,126,96,3,245,36,249,168,101,65,135,231,59,244,141,110,34,235,239,58,179,8,198,169,79,82,86,62,130,222,103,159,31,237,236,182,153,134,37,75,158,160,224,181,13,217]}`));