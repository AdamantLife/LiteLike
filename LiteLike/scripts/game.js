"use strict";

import {Character, roles} from "./character.js";
import {Combat, CharacterAction, actiontypes} from "./combat.js";

import * as MAP from "./map.js";
import * as EVENTS from "./events.js";
import * as IO from "./io.js";
import * as EQUIP from "./equipment.js";
import { callbacks } from "./callbacks.js";


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

        // Database of all equipment
        this.EQUIPMENT = null;
        // Load the equipment
        IO.loadEquipment()
            .then(result=>{this.EQUIPMENT = result;})
            .catch(error=> console.log(error));

        // Plyaer Character
        this.PLAYER = null;

        // Current Map
        this.MAP = null;

        // Current Combat being executed (if any)
        this.COMBAT = null;
    }

    /**
     * Runs a demo
     */
    runDemo(){

        // Get the output space
        let fightbox = document.getElementById("fightBox");

        // Create a new player Character
        this.PLAYER = this.startingCharacter();
        
        // Create Enemy
        let enemy = new Character(1, [roles.CHARACTER, roles.ENEMY],
            {
                "hp": 5,
                "currentHP": 5
            },
            {
                "weapons": [new EQUIP.Weapon(this.EQUIPMENT.weapons[1])],
                "armor": this.EQUIPMENT.armor[0],
                "items":[]
            });


        /**
         * Creates a Table on the Homepage outlining the character's stats
         * @param {Character} chara - The character to output
         */
        function outputCharacter(chara){
            // Get the description of the Character in the current Language
            let string = IO.getStrings(this.STRINGS, chara);

            // Display Character's Statistics
            fightbox.insertAdjacentHTML(`beforeend`,`
    <table>
        <tbody>
            <tr>
                <td colspan=2><h1 title="${string.flavor}">${string.name}</h1></td>
            </tr>
            <tr>
                <td><b>HP:</b></td>
                <td title="Current HP">${chara.statistics.currentHP} <i title="Max HP">(${this.PLAYER.statistics.hp})</i></td>
            </tr>
        </tbody>
    </table>`
            );

            // Getting a reference to the created html table so we can add
            // more Character Information to it
            let table = fightbox.lastElementChild;
            let body = table.getElementsByTagName("tbody")[0];

            // Display all the Character's weapons
            for(let weapon of chara.weapons){

                // Use getStrings to get name and flavor text for the current weapon
                let strings = IO.getStrings(this.STRINGS, weapon);
                
                // Display weapon statistics
                body.insertAdjacentHTML(`beforeend`, `
    <tr>
        <td><b>Weapon</b></td>
        <td><span title="${strings.flavor}">${strings.name}</span></td>
    </tr>`
            );
            }

            // Display Armor Statistics
            string = IO.getStrings(this.STRINGS, chara.armor);
            body.insertAdjacentHTML(`beforeend`,`
    <tr>
        <td><b>Armor</b></td>
        <td><span title="${string.flavor}">${string.name}</span></td>
    </tr>`
            );

            // Display all the Character's Items
            for(let item of chara.items){

                // Use getStrings to get name and flavor text for the current item
                let strings = IO.getStrings(this.STRINGS, item);
                
                // Display item statistics
                body.insertAdjacentHTML(`beforeend`, `
    <tr>
        <td><b>Item</b></td>
        <td><span title="${strings.flavor}">${strings.name} <i>(Qty:${item.quantity})</i></span></td>
    </tr>`
                );
            }

        }
        /* End outputCharacter*/

        outputCharacter.bind(this)(this.PLAYER);
        outputCharacter.bind(this)(enemy);

       
        this.COMBAT = new Combat(this.PLAYER, enemy);

        /**
         * AI to control the player during the demo
         * @param {Event} event - The Combat Event callback
         */
        function playerAI(event){
            let action = null;
            // Combat is over, do nothing
            if(event.combat.victor !== null) return;

            let player = event.player;

            // Character is pretty injured, heal if we can
            if(player.statistics.currentHP <= player.statistics.hp / 2 &&
            player.items.length // Player's only item is 1 repair bot in this demo
            ){
                action = CharacterAction(player, actiontypes.ITEM, player.items[0], event.enemy);
            }else{ // Either the Player is not badly injured or it cannot heal anymore
                // So just attack (if we can)
                // Copied from enemy AI
                let weapon =player.firstFireableWeapon();
                // If no weapon is immediately fireable, use the first available one instead
                weapon = weapon ? weapon : player.firstAvailableWeapon();
                // If the player has a weapon it can use, use it
                if(weapon) action = CharacterAction(player, actiontypes.WEAPON, weapon, event.enemy);
            }

            // Stick action on PlayerQueue if we have one
            if (action) event.combat.playerQueue.push(action);
        }

        /**
         * Output weapon attacks to the homepage
         * @param {Event} event 
         */
        function useWeapon(event){
            // TODO
        }

        /**
         * Output item usage to the homepage
         * @param {Event} event 
         */
        function useItem(event){
            // ToDo
        }

        this.COMBAT.addEventListener("startloop", playerAI.bind(this));
        this.COMBAT.addEventListener("useweapon", useWeapon.bind(this));
        this.COMBAT.addEventListener("useitem", useItem.bind(this));

        this.COMBAT.combatLoop();
    }

    /**
     * Returns a starting player character
     */
    startingCharacter(){
        return new Character(0, [roles.CHARACTER, roles.PLAYER],
            {hp:5, currentHP: 5},
            {
                weapons: [new EQUIP.Weapon(this.EQUIPMENT.weapons[0])],
                armor:this.EQUIPMENT.armor[0],
                items:[new EQUIP.Item(this.EQUIPMENT.items[0], 1)]
            })
    }
}

window.GAME = new Game(JSON.parse(`{"i":7,"j":8,"S":[250,210,70,5,116,152,156,50,109,197,228,20,149,6,176,124,151,69,33,148,196,45,94,41,171,90,73,91,218,61,212,206,137,44,213,118,227,38,180,93,15,208,233,145,17,187,11,205,108,78,115,138,77,16,54,87,88,242,39,175,21,128,253,193,10,66,80,129,191,18,29,173,104,142,105,214,161,204,67,71,40,12,133,203,7,107,143,89,254,127,255,144,234,241,100,238,150,60,185,225,140,172,247,216,200,232,1,32,114,113,2,99,24,51,64,9,42,230,201,177,219,123,164,186,14,162,221,52,26,184,163,194,122,220,167,157,68,155,19,166,131,92,53,48,97,125,27,248,146,192,215,55,35,209,74,111,251,47,46,240,243,25,195,207,178,95,139,147,246,49,98,211,119,226,102,183,85,83,189,188,170,63,22,56,252,72,81,4,112,199,202,174,154,223,132,106,120,43,28,76,57,117,229,84,136,30,0,121,23,165,190,126,96,3,245,36,249,168,101,65,135,231,59,244,141,110,34,235,239,58,179,8,198,169,79,82,86,62,130,222,103,159,31,237,236,182,153,134,37,75,158,160,224,181,13,217]}`));