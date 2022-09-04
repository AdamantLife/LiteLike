"use strict";

import {Character, roles} from "./character.js";

import * as MAP from "./map.js";
import * as EVENTS from "./events.js";
import * as IO from "./io.js";


export class Game{
    constructor(state){
        if(typeof state !== "undefined"){
            this.random = new Math.seedrandom("", {state});
        }else{
            this.random = new Math.seedrandom(Math.random(), {state:true});
        }
        this.LANGUAGE = "english";
        this.STRINGS = null;
        IO.loadStrings(this.LANGUAGE);
        this.EQUIPMENT = null;
        IO.loadEquipment()
            .then(result=>{this.EQUIPMENT = result;})
            .catch(error=> console.log(error));
        this.PLAYER = null;
        this.MAP = null;
        this.COMBAT = null;
    }

    /**
     * Runs a demo
     */
    runDemo(){
        let fightbox = document.getElementById("fightBox");
        this.PLAYER = this.startingCharacter();
        // TODO: Display Player stats
        // TODO: Make Enemey Character
        // TODO: Do Combat
    }

    /**
     * Returns a starting player character
     */
    startingCharacter(){
        return Character(0, [roles.CHARACTER, roles.PLAYER],
            {hp:5, currentHP: 5},
            {weapons: [this.EQUIPMENT.weapons[0]],
                armor:this.EQUIPMENT.armor[0]})
    }
}

window.GAME = new Game(JSON.parse(`{"i":7,"j":8,"S":[250,210,70,5,116,152,156,50,109,197,228,20,149,6,176,124,151,69,33,148,196,45,94,41,171,90,73,91,218,61,212,206,137,44,213,118,227,38,180,93,15,208,233,145,17,187,11,205,108,78,115,138,77,16,54,87,88,242,39,175,21,128,253,193,10,66,80,129,191,18,29,173,104,142,105,214,161,204,67,71,40,12,133,203,7,107,143,89,254,127,255,144,234,241,100,238,150,60,185,225,140,172,247,216,200,232,1,32,114,113,2,99,24,51,64,9,42,230,201,177,219,123,164,186,14,162,221,52,26,184,163,194,122,220,167,157,68,155,19,166,131,92,53,48,97,125,27,248,146,192,215,55,35,209,74,111,251,47,46,240,243,25,195,207,178,95,139,147,246,49,98,211,119,226,102,183,85,83,189,188,170,63,22,56,252,72,81,4,112,199,202,174,154,223,132,106,120,43,28,76,57,117,229,84,136,30,0,121,23,165,190,126,96,3,245,36,249,168,101,65,135,231,59,244,141,110,34,235,239,58,179,8,198,169,79,82,86,62,130,222,103,159,31,237,236,182,153,134,37,75,158,160,224,181,13,217]}`));