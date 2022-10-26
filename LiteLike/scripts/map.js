"use strict";

import * as UTILS from "./utils.js";

// Map is 21x21 grid
const MAPSIZE = 21;
// Coords are 0-index, so 10,10 is center of map
// Coordinates are (x, y)
const HOMECOORD = [10,10];
// Each square costs 1 reactorFuel
const MOVEFUELCOST = 1;
// Every 2 squares costs 1 Repair Bots (this is cost for 1 square)
// Repair Bots are rounded up
const MOVEREPAIRCOST = 1/2;

// How the Player is represented on the Text Map
// This is the traditional rogue symbol
const PLAYERSYMBOL = "@";

export const directions = UTILS.enumerate("NORTH","EAST","SOUTH","WEST");

export const mapactions = UTILS.enumerate("MOVE");

export class MapAction{
    /**
     * Initializes a new MapAction which can be added to Map.playerQueue
     * @param {Symbol | String} action - a mapaction symbol or it's string
     * @param {*} value - an appropriate value for the given action
     */
    constructor(action, value){
        // this is a String: convert it to a Symbol
        if(typeof mapactions[action] !== "undefined") action = mapactions[action];
        this.action = action;
        this.value = value;
    }
}

/**
 * Object managing the map
 */
export class Map extends UTILS.EventListener{
    static EVENTTYPES = UTILS.enumerate(
        "loopstart", "loopend",
        "movestart", "move", "moveend"
    );

    /**
     * 
     * @param {String | null} seed - Random Seed for the map (if not provided, one will be created
     * @param {String} mask - String representing the revealed map
     * @param {Character} player - The Player Character
     */
    constructor(seed, mask, player){
        super(Map.EVENTTYPES);
        this.seed = seed;
        this.mask = mask;
        this.map = null;
        this.player = player;
        this.playerLocation = null;
        // Set default location as HOMECOORD
        this.moveToHome();

        this.playerQueue = [];
        this.mapLock = true;
        this.loopid;
    }

    /**
     * Convenience function to change the Player's Location
     * to HOMECOORD; does not trigger any movement effects
     */
    moveToHome(){
        this.playerLocation = Array.from(HOMECOORD);
    }

    /**
     * Returns the manhattan distance between HOMECOOD and playerLocation
     * @returns {Number} - The manhattan distance from Home to the Player's Coord
     */
    distanceFromHome(){
        return Math.abs(this.playerLocation[0] - HOMECOORD[0])+ Math.abs(this.playerLocation[1] - HOMECOORD[1]);
    }

    moveLoop(){
        this.triggerEvent(Map.EVENTTYPES.loopstart, {});
        let playerQueue = Array.from(this.playerQueue);
        this.playerQueue = [];
        if(this.mapLock) return this.loopid = window.setTimeout(this.moveLoop.bind(this), UTILS.LOOPRATE);
        let moves = [];

        // Sort the actions into moves and inventory
        for(let action of playerQueue){
            if(action.action === mapactions.MOVE) moves.push(action.value);
        }

        // Right now we're only resolving the first move action in the queue
        if(moves.length) this.handleMove(moves[0]);
        
        this.triggerEvent(Map.EVENTTYPES.loopend, {});
        this.loopid = window.setTimeout(this.moveLoop.bind(this), UTILS.LOOPRATE);
    }

    /**
     * Takes a direction and attempts to move the character in that direction
     * We could execute them all, but that could introduce exploits.
     * @param {Symbol | String} direction - A  enumerated direction string or Symbol
     */
    handleMove(direction){
        if(typeof direction !== "symbol") direction = directions[direction];
        // invalid direction
        if(typeof direction === "undefined") return;

        let result;
        [direction, result] = this.move(direction);
        this.triggerEvent(Map.EVENTTYPES.moveend, {direction, playerLocation: this.playerLocation});

        console.log(direction, result)
        if(!result) return;
        // Subtract the required fuel
        // NOTE - There didn't seem to be a cost-difference for terrain type in A Dark Room
        //          If there was, we would calclulate that here
        this.player.equipment.transport.reactorPower -= MOVEFUELCOST;
        // Subtract required repair cost
        // Repairbots are always the first (0-index) item
        this.player.equipment.items[0].quantity -= MOVEREPAIRCOST;
    }

    /**
     * 
     * @param {String} direction 
     */
    move(direction){
        this.triggerEvent(Map.EVENTTYPES.movestart, {direction, playerLocation: this.playerLocation});
        if(typeof direction !== "symbol") direction = directions[direction];
        console.log(`Moving: ${direction.description}`)
        let curr = [... this.playerLocation];
        // Each direction changes the Player's positions by 1 square in the
        // x or y axis
        switch(direction){
            case directions.NORTH:
                curr[1]-=1;
                break;
            case directions.EAST:
                curr[0]+=1;
                break;
            case directions.SOUTH:
                curr[1]+=1;
                break;
            case directions.WEST:
                curr[0]-=1;
                break;
            default: // As always, we should raise an error, but are not for simplicity's sake
                return [null, null];
        }
        // Make sure we haven't moved off the map
        if(0 <= curr[0] <= MAPSIZE-1 && 0 <= curr[1] <= MAPSIZE-1){
            // Update player's location
            this.playerLocation = curr;
            this.triggerEvent(Map.EVENTTYPES.move, {direction, playerLocation: this.playerLocation});
            return [direction, true];
        }
        // We return without doing anything if we moved off the map (return null;)
    }


    /**
     * Returns the map as an array of strings.
     * 
     * If mask is provided, it should map 1-for-1 onto the Map and will be used Booleaned with each coordinate on the
     * map. If the mask is 1, then the character at the given coordinate will be displayed; otherwise, that coordinate
     * will be converted to a space.
     * @param {Number[] | null} mask - A series of Zeroes and non-Zeroes which will be mapped onto the map string
     * @returns {String[]} - The map
     */
    getMap(mask){
        if(typeof mask === "undefined") mask = this.mask;

        // Copy the map
        let map = Array.from(this.map);
        
        // Get the row the Player is on so we can add him
        let row = map[this.playerLocation[1]];
        
        map[this.playerLocation[1]] =                   // Replace the row with
            row.substring(0,this.playerLocation[0])     // The row up to the Player
            + PLAYERSYMBOL                              // The Player Symbol
            + row.substring(this.playerLocation[0]+1);  //  The rest of the the row

        // No mask, just return
        if(!mask || typeof mask === "undefined") return map;

        // Iterator for both map and mask
        for(let i = 0; i < map.length; i++){
            // Split the current map row into individual characters
            let mapstringarray = map[i].split("");
            let maskarray = mask[i];
            let rowmaskvalue = maskarray.reduce((a,b)=>a+b);
            // If maskarray is empty (All zeroes), do not show any characters on this row
            if(!rowmaskvalue){
                // Empty row
                map[i]="                     ";
                continue;
            // If maskarray is all 1's
            }else if(rowmaskvalue == MAPSIZE){
                // Everything is displayed as-is
                continue;
            }
            // In this case some characters in the array are displayed and some are not
            let out = "";
            // Iterator for both mapstringarray and the current mask row(mask[i])
            // If there's a character at mapstringarray[x] and mask[i][x] is not 0,
            // then add the character to the output; otherwise add a space
            for(let x = 0; x < mapstringarray.length; x++) out += mapstringarray[x]&&maskarray[x]? mapstringarray[x] : " ";

            // Replace the map row with the masked output
            map[i] = out;
        }

        // Return the masked map
        return map
    }
}