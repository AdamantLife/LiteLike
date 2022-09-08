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

const directions = UTILS.enumerate("NORTH","EAST","SOUTH","WEST");



/**
 * Object managing the map
 */
class Map {

    /**
     * 
     * @param {String | null} seed - Random Seed for the map (if not provided, one will be created
     * @param {String} mask - String representing the revealed map
     * @param {Character} player - The Player Character
     */
    constructor(seed, mask, player){
        this.seed = seed;
        this.mask = mask;
        this.player = player;
        // Set default location as HOMECOORD
        this.playerLocation = this.moveToHome();
    }

    /**
     * Convenience function to change the Player's Location
     * to HOMECOORD; does not trigger any movement effects
     */
    moveToHome(){
        this.playerLocation = Array.from(HOMECOORD);
    }

    /**
     * 
     * @param {String} direction 
     */
    move(direction){
        if(typeof direction !== "Symbol") direction = directions[direction];
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
                return;
        }
        // Make sure we haven't moved off the map
        if(0 <= curr[0] <= MAPSIZE-1 && 0 <= curr[1] <= MAPSIZE-1){
            // Update player's location
            this.playerLocation = curr;
            // Subtract the required fuel
            // NOTE - There didn't seem to be a cost-difference for terrain type in A Dark Room
            //          If there was, we would calclulate that here
            this.player.equipment.transport.reactorPower -= MOVEFUELCOST;
            // Subtract required repair cost
            // Repairbots are always the first (0-index) item
            this.player.equipment.items[0].quantity -= MOVEREPAIRCOST;
            
            // NOTE- the Game should handle any consequences of moving
            // (e.g.- Random Encounters, entering towns, running out of Fuel or Repair Bots)
        }
        // We return without doing anything if we moved off the map
    }
}