"use strict";
import * as EQUIP from "./equipment.js";
import {instanceFromJSON} from "./utils.js";
import {callbacks} from "./callbacks.js";

/**
 * Loads the equipment json file and parses it into equipment classes
 */
export function loadEquipment(){
    function parse(data){
        let weapons = [], armor = [], items = [];

        // Weapons can all be parsed directly from json
        for(let weapon of data.weapon){
            weapons.push(instanceFromJSON(EQUIP.WeaponType, weapon));
        }

        // Armor can all be parsed driectly from json
        for(let arm of data.armor){
            armor.push(instanceFromJSON(EQUIP.Armor, arm));
        }

        // Item callbacks need to be generated based on their arguments
        for(let item of data.item){
            // get Callback name
            let cb = item.callback;
            // Get args in order to create the callback
            let args = item.arguments;
            // Remove arguments from item as the ItemType class
            // does not accept them
            delete item.arguments;
            // Convert the callback name  to the actual callback
            // as returned by the callback factory
            item.callback = callbacks[cb](...args);

            // add item to list
            items.push(instanceFromJSON(EQUIP.ItemType, item));
        }

        return {weapons, armor, items};
    }

    return fetch("./entities/equipment.json").then(r=>r.json()).then(data=>parse(data))
}

/**
 * Loads strings for the given language
 * @param {String} language - The language to laod
 */
export function loadStrings(language){
    const LANGUAGES = ["english"];
    if(LANGUAGES.indexOf(language) < 0 ) throw new Error(`Invalid Language: ${language}`);
    return fetch(`./strings/${language}.json`).then(r=>r.json());
}