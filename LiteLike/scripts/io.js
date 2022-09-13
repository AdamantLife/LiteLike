"use strict";
import * as EQUIP from "./items.js";
import {instanceFromJSON} from "./utils.js";
import {itemCallbacks} from "./callbacks.js";

/**
 * Loads the equipment json file and parses it into equipment classes
 */
export function loadEquipment(){
    function parse(data){
        let weapons = [], armor = [], items = [], resources = [], transports = [];

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
            item.callback = itemCallbacks[cb](...args);

            // add item to list
            items.push(instanceFromJSON(EQUIP.ItemType, item));
        }

        // Resources can all be parsed driectly from json
        // Each Resource's id is its index in the Resource array
        for(let id = 0; id < data.resource.length; id++){
            // Get resource by id
            let res = data.resource[id];
            // Set the resource's id
            res.id = id;
            // Convert json to Resource Object and add to list
            resources.push(instanceFromJSON(EQUIP.ResourceType, res));
        }

        // Transports can all be parsed driectly from json
        // Each Transport's id is its index in the Transport array
        for(let id = 0; id < data.transport.length; id++){
            // Get transport by id
            let tran = data.transport[id];
            // Set the transport's id
            tran.id = id;
            // Convert json to Transport Object and add to list
            resources.push(instanceFromJSON(EQUIP.Transport, tran));
        }

        return {weapons, armor, items, resources, transports};
    }

    return fetch("./entities/items.json")   // Fetch items.json from the server
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

        // ITEMS
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
        case "Resource":
        case "ResourceType":
            id = typeof object.resourcetype === "undefined" ? object.id : object.resourcetype.id;
            dict = language.resource;
            break;
        case "Transport":
            id = object.id;
            dict = language.transport;
            break;

        // BASE SPECIFIC
        case "Sector":
            id= obj.id;
            dict = language.sector;
            break;
        case "Job":
            id = obj.id;
            dict = language.job;
            break;
        default:
            return {"name":"Unknown", "flavor": "Unknown"}
    }
    return dict[id];
}