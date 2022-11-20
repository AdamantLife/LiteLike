"use-strict";

import * as IO from "../io.js";
import * as ENCOUNTERS from "../encounters.js";
import * as ENCOUNTERSGUI from "./encounters.js";


/**
 * Populates the reward box with the given rewards and adds the control logic
 * 
 * @param {Function} callback - The exit callback to call on close
 */
export function loadRewardEvent(callback){
    let rewards = GAME.ENCOUNTER.get().reward;
    let eventBox = ENCOUNTERSGUI.clearEvents();
    
    // Add main, reward table, and close button
    eventBox.insertAdjacentHTML('beforeend', `<div class="eventsmain"><table><tbody id="rewardarea"></tbody</table></div><button id="eventexit">Close</button>`);
    // Attach exit callback
    document.getElementById("eventexit").onclick = ()=>callback(GAME.ENCOUNTER.get());
    
    // Add rewards
    for(let reward of rewards){
        // Get the item's type
        let type = reward.reward.type;
        // TODO: handle non-equipment rewards

        addReward(reward)
    }

    // Show Reward event
    ENCOUNTERSGUI.showEvents(eventBox);
}

/**
 * Adds a reward to the GUI
 * @param {ENCOUNTERS.Reward} reward - The reward to add 
 */
function addReward(reward){
    // Get reference to reward display area for later
    let rewardarea = document.getElementById("rewardarea");

    // Getting easier reference to player
    let player = GAME.PLAYER;

    let strings = IO.getStrings(GAME.STRINGS, reward.reward);

    // Get quantity (weapon doesn't have quantity, so default 1)
    let quantity = typeof reward.reward.quantity == "undefined" ? 1 : reward.reward.quantity;

    rewardarea.insertAdjacentHTML(`beforeend`, `<tr data-type="${reward.type}" data-id="${reward.reward.type.id}"><td class="reward"><span title="${strings.flavor}" data-name >${strings.name} x </span><span data-qty>${quantity}</span>
<div class="splitbutton">
    <button class="collection">Collect</button>
    <div class="dropdownarrow">
        <button></button>
        <div class="dropdownlist">
        </div>
    </div>
</div>
        </td></tr>`);
        
        let row = rewardarea.lastElementChild;
        // We're passing in row because it's more complicated to navigate up the tree to find the shared parent
        // we're looking for and then navigate back down to the element we actually want to interact with
        // Clicking on button collects max reward player can carry
        row.querySelector("button.collection").onclick = (event)=>collectReward(event, row, reward, player);
        // Hovering over the dropdown arrow populates a list of items the player can drop to make space
        row.querySelector("div.dropdownarrow>button").addEventListener("mouseover", (event)=>updateCache(event, row, reward, player));
        // Clicking on an item in the dropdown list moves the item from the player's equipment to the reward area
        // This callback then calls the collectReward function, so we'll give it row and reward so it can pass those along 
        row.querySelector("div.dropdownarrow>div.dropdownlist").addEventListener("click", (event)=>exchangeCache(event, row, reward, player));
}

/**
 * Adds a new reward to the event and the gui; this is due to dropping equipment to collect other rewards
 * @param {ENCOUNTERS.Reward} reward - The new reward to add
 */
function addRewardToEvent(reward){
    let rewards = GAME.ENCOUNTER.get().reward;
    // If the item is a weapon, we just add it and move on
    if(reward.type == "Weapon"){
        // Add to event rewards
        rewards.push(reward);
        // Add to GUI and return
        return addReward(reward);
    }

    // Check if the reward already exists in the event
    for(let other of rewards){
        // Check base type (item, resource)
        if(other.type !== reward.type) continue;
        // Check item id
        if(other.reward.type.id !== reward.reward.type.id) continue;
        // Same item type and item id, so add quantity
        other.reward.quantity += reward.reward.quantity;

        // Find row in gui to update quantity
        document.getElementById("rewardarea")
            .querySelector(`tr[data-type="${reward.type}"][data-id="${reward.reward.type.id}"] span[data-qty]`).textContent = other.reward.quantity;
        return;
    }

    // Brand new item, so add it to Event
    rewards.push(reward);
    // and GUI
    addReward(reward);
}


/**
 * Collects the maximum quantity of the given reward and adjusts the gui as necessary
 * @param {Event} event - Event is not used
 * @param {Element} row - The Row Element in the rewards table for the reward
 * @param {ENCOUNTERS.Reward} reward - The Reward being collected
 * @param {Character} player - The palyer character
 */
function collectReward(event, row, reward, player){
    if(!player || typeof player == "undefined") player = GAME.PLAYER;
    // Getting key stats
    let capacity = player.equipment.transport.capacity;
    let carryweight = player.weight;
    let freeweight = capacity - carryweight;

    // Get info for reward
    let r = reward.reward
    let weight = r.type.weight;
    let qty = typeof r.quantity == "undefined" ? 1 : r.quantity;
    
    function collect(item){
        // Add item to equipment.weapons
        if(item.constructor.name == "Weapon"){
            player.equipment.weapons.push(item);
            player.triggerEvent("equipmentchange", {subtype: "weapons", item});
        } // Add itmem to equipment.items
        else if(item.constructor.name == "Item"){
            player.addItem(item)
            player.triggerEvent("itemschange", {[player.getItemIndex(item.itemtype.id)]: item.quantity});
        }else if(item.constructor.name == "Resource"){
            player.addResource(item);
            player.triggerEvent("resourceschange", {[item.resourcetype.id]: item.quantity});
        }
    }

    // Calculate how much we can collect
    let collectquantity = Math.min(
        // Maximum amount of the item we can currently carry
        Math.floor(freeweight / weight), 
        // Dont collect more than the reward has
        qty
    );
    // We can't collect any of the object, so return
    if(!collectquantity) return;

    // We'll default collect everything
    let collection = r;
    // Then, if we need to reduce the amount, we'll make adjustments
    if(collectquantity < qty){
        // Make a new object to add to the player with the amount we want to collect
        collection = r.new(collectquantity)
        // Reduce the reward quantity by that amount
        r.quantity -= collectquantity;
        // Update GUI

        // Find row in gui to update quantity
        document.getElementById("rewardarea")
            .querySelector(`tr[data-type="${reward.type}"][data-id="${r.type.id}"] span[data-qty]`).textContent = r.quantity;

    }else{
        // If we're collecting the full reward, remove it from the gui
        row.remove();
        // And remove it from the Event Rewards
        GAME.ENCOUNTER.get().reward.splice(GAME.ENCOUNTER.get().reward.indexOf(reward), 1);
    }

    // Add it to the player
    collect(collection);
}

/**
 * Update the list of items that can be dropped in order to collect the reward
 * @param {Event} event - The mouseover event
 * @param {Element} row - The Row Element in the rewards table for the reward
 * @param {ENCOUNTERS.Reward} reward - The reward being collected
 * @param {Character} player - The player character
 */
function updateCache(event, row, reward, player){
    if(!player || typeof player == "undefined") player = GAME.PLAYER;
    // Getting key stats
    let capacity = player.equipment.transport.capacity;
    let carryweight = player.weight;
    let freeweight = capacity - carryweight;

    // Get info for reward
    let r = reward.reward;
    let weight = r.type.weight;
    let qty = typeof r.quantity == "undefined" ? 1 : r.quantity;
    let weightreq = weight * qty;
    
    // The list to populate
    let dropdown = row.querySelector(".dropdownlist");
    
    // Clear list before we begin
    while(dropdown.lastElementChild) dropdown.lastElementChild.remove();

    // We can already collect all of it, so no need to populate list
    if(weightreq <= freeweight) return;

    let strings, collectible, droppable, type, itemqty;
    // Iterate over each object in weapons, items, and resources
    for(let item of [...player.weapons, ...player.items, ...Object.values(player.resources)]){
        // Get the item's type
        type = item.type;
        // items and resources are stackable, so they have a quantity
        // If it doesn't (it's a weapon), set the qty to 1
        itemqty = typeof item.quantity == "undefined" ? 1 : item.quantity;
        // Determine the max quantity of the reward we can collect
        collectible = Math.min(
            // This is the max number of rewards we could get by
            // exchanging all of the current item for the rewards
            Math.floor( (freeweight + type.weight * itemqty) / weight), 
            // This is how many rewards there actually are
            qty
        )
        // On the offchance dropping wouldn't do any good
        if(!collectible) continue;

        // Determine how many items we need to drop in order to
        // fill that collection
        droppable = Math.floor((collectible * weight - freeweight) / type.weight);

        strings = IO.getStrings(GAME.STRINGS, item);

        // Add item to dropdown
        dropdown.insertAdjacentHTML('beforeend', `<span data-type="${item.constructor.name}" data-id="${type.id}" data-droppable="${droppable}">${strings.name}: ${droppable}</span>`);
    }
}

/**
 * Exchanges the calculated amount of the selected item for the maximum reward quantity
 * @param {Event} event - dropdownlist.click event
 * @param {Element} row - the Reward's row to pass on to collectReward
 * @param {ENCOUNTERS.Reward} reward - the Reward being collected to pass on to collectReward
 * @param {Character} player - The player character
 */
function exchangeCache(event, row, reward, player){
    if(!player || typeof player == "undefined") player = GAME.PLAYER;
    let itemele = event.target;
    // Get precalculated information
    let type = itemele.dataset.type, item = itemele.dataset.id, droppable = parseInt(itemele.dataset.droppable);


    // Convert to player's object
    if(type == "Weapon"){
        // Get the weapon
        item = player.getWeapon(item);
        
        // Weapon functions slightly differently from item and resource
        // so we're going to resolve weapon completely here

        // Remove the weapon from the player
        // NOTE: Weapon order matters to us, so we'll overwrite the weapon slot instead
        // of splicing the list
        player.weapons[player.getWeaponIndex(item)] = null;

        // Remove element from dropdown
        itemele.remove();

        // Collect the maximum amount of the reward we can
        collectReward(event, row, reward, player);

        // Add Dropped Item back into reward area
        addRewardToEvent(new ENCOUNTERS.Reward("Weapon", item));
    }
    else if(type == "Item"){
        item = player.getItem(item);
    }
    else if( type == "Resource"){
        item = player.getResource(item);
    }
    
    // Make a copy of it with the amount we're dropping to add back into the Rewards Area
    let newreward = item.new(droppable)
    // Remove the droppable quantity from the player's item
    item.quantity -= droppable;
    // Remove element because we already calculated that we can't collect more from it
    itemele.remove();
    // Collect the maximum amount of the reward we can
    collectReward(event, row, reward, player);
    
    // Add Dropped Item back into reward area
    addRewardToEvent(new ENCOUNTERS.Reward(type, newreward));
}

