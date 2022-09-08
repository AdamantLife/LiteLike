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
        // Each Weapon's id is its index in the weapon array
        for(let id = 0; id < data.weapon.length; id++){
            // Get weapon by id
            let weapon = data.weapon[id];
            // Set the weapon's id
            weapon.id = id;
            // Add the WeaponType Instance to the weapons output
            weapons.push(instanceFromJSON(EQUIP.WeaponType, weapon));
        }

        // Armor can all be parsed driectly from json
        // Each Armor's id is its index in the Armor array
        for(let id = 0; id < data.armor.length; id++){
            // Get armor by id
            let arm = data.armor[id];
            // Set the armor's id
            arm.id = id;
            armor.push(instanceFromJSON(EQUIP.Armor, arm));
        }

        // Item callbacks need to be generated based on their arguments
        // Each Item's id is its index in the Item array
        for(let id = 0; id < data.item.length; id++){
            // Get item by id
            let item = data.item[id];
            // Set the item's id
            item.id = id;
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

    return fetch("./entities/equipment.json")   // Fetch equipment.json from the server
        .then(r=>r.json())                      // Then convert the file to an Object (json)
        .then(data=>parse(data))                // The pass the converted object to the parse function
    // Return the resulting promise so that the calling function can take
    // action after it is done
}

/**
 * Loads strings for the given language
 * @param {String} language - The language to laod
 */
export function loadStrings(language){
    // Valid Languages
    const LANGUAGES = ["english"];
    // Make sure that language is a valid language
    if(LANGUAGES.indexOf(language) < 0 ) throw new Error(`Invalid Language: ${language}`);

    return fetch(`./strings/${language}.json`) // Fetch the language dict from the server
        .then(r=>r.json()); // Then convert the file to an Object (json)
    // Return the resulting promise so the calling function can do something afterwards
}

/**
 * Searches the Language Object for the given Entity and returns its entry
 * @param {Object} language - A Language Object as returned by loadStrings
 * @param {Object} object - An entity
 */
export function getStrings(language, object){
    let id, dict;
    switch(object.constructor.name){
        case "Entity":
        case "PlayerCharacter":
        case "CombatCharacter":
            id=object.id;
            dict = language.character;
            break;
        case "Weapon":
        case "WeaponType":
            id = typeof object.weapontype === "undefined" ? object.id : object.weapontype.id;
            dict = language.weapon;
            break;
        case "Armor":
            id = object.id;
            dict = language.armor;
            break;
        case "Item":
        case "ItemType":
            id = typeof object.itemtype === "undefined" ? object.id : object.itemtype.id;
            dict = language.item;
            break;
        default:
            return {"name":"Unknown", "flavor": "Unknown"}
    }
    return dict[id];
}