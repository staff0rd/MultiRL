/*
 * monsters.js - Central monsters repository for Ganymede Gate
 *
 * Code style:
 * 4 space indents, no semicolons to finish lines, camelCase, opening braces on same line
 *
 * Created by John Villar for the "Ganymede Gate" sci-fi multiplayer roguelike
 * http://ganymedegate.com
 * Twitter: @johnvillarz
 * Reddit: /u/chiguireitor
 * Google Plus: +JohnVillar
 *
 * Like this! Follow me on social networks & send some Bitcoin my way if you want ;)
 *
 * BTC: 1kPp2CNp1xs7hf8umUwdp4HYiZ9AH1NVk
 *
 * // Beginning of license //
 *
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 John Villar
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * // End of license //
 *
 */
 
var asciiMapping = require('./templates/ascii_mapping.js') // Code shared between client and server
var items = require('./items.js')
var fsm = require('./fsm.js')
var comms = require('./comms.js')
var util = require('./util.js')
var soundManager = require('./soundman.js').getManager()
var particles = require('./particles.js')
var aiState = require('./ai.js')

var generator

var squadFsm = fsm.loadStateMachine('./static/squad_ai.fzm', {}, function() { /*console.log(squadFsm.variables)*/ })
var squadHandlersAdded = false

function registerGenerator(gen) {
    generator = gen
}

var currentAgent
var currentLevel
var currentAi

var updateGlobalVars = function(state) {
    /*hostile_seen: false,
    pkt_fail: false,
    pkt_ok: false,
    no_squad: false,
    high_level: false,
    low_level: false,
    squad_not_found: false,
    squad_found: false,
    leader_near: false,
    hp_low: false,
    hostile_in_range: false,
    hostile_out_of_range: false,
    hostile_reported: false,
    hostile_terminated: false,
    loot_spotted: false,
    above_loot: false,
    inventory_full: false,
    better_weapon_inventory: false*/
    
    var vars = state.variables
    
    if (vars) {
        var broadcastedPkt = currentAgent.comms.peek()
        if (broadcastedPkt) {
            if (!(broadcastedPkt.msgNum in vars.pktsSent)) {
                
                if ('need_backup' in broadcastedPkt.msg) {
                    if (broadcastedPkt.msg.need_backup.squad == vars.squad) {
                        console.log('someone from my squad asked for backup')
                        vars.hostile_seen = true
                        vars.hostile_position = {x: broadcastedPkt.msg.need_backup.x, y: broadcastedPkt.msg.need_backup.y}
                        vars.same_hostile_ask_backup = -5
                        vars.is_my_hostile = false
                        vars.hostile_reported = true
                        vars.t = 0
                    }
                } else if ('hostile_seen' in broadcastedPkt.msg) {
                    vars.hostile_seen = true
                    vars.hostile_position = {x: broadcastedPkt.msg.hostile_seen.x, y: broadcastedPkt.msg.hostile_seen.y}
                    vars.is_my_hostile = false
                    vars.hostile_reported = true
                }
            } else {
                console.log('Received a pkt i sent', broadcastedPkt.msgNum, broadcastedPkt)
                delete vars.pktsSent[broadcastedPkt.msgNum]
            }
        }
        
        if (vars.last_pkt) {
            if (currentAgent.comms.pktOk(vars.last_pkt)) {
                vars.pkt_ok = true
                vars.t = 0
            } else {
                vars.pkt_fail = true
                vars.t = 0
            }
            vars.last_pkt = false
        }
        
        vars.out_of_ammo = currentAgent.weapon && (currentAgent.weapon.ammo <= 0)
        
        var aggro = currentAi.findNearestPlayer(currentAgent.pos.x, currentAgent.pos.y, currentAgent.fov)
        
        if (aggro && (aggro != vars.hostile)) {
            vars.hostile_seen = true
            vars.hostile_position = {x: aggro.pos.x, y: aggro.pos.y}
            vars.hostile = aggro
            vars.last_hostile_reported = false
            vars.hostile_reported = false
            vars.is_my_hostile = true
            vars.pkt_ok = false
            vars.pkt_fail = false
            vars.same_hostile_ask_backup = 0
        } else if (aggro) {
            vars.hostile_seen = true
            vars.hostile_position = {x: aggro.pos.x, y: aggro.pos.y}
            vars.same_hostile_ask_backup = 0
            vars.hostile_reported = false
            vars.is_my_hostile = true
            
            var dx = aggro.pos.x - currentAgent.pos.x
            var dy = aggro.pos.y - currentAgent.pos.y
            var d2 = dx * dx + dy * dy
            var wd2 = currentAgent.weapon.range * currentAgent.weapon.range
            
            if (d2 <= wd2) {
                vars.hostile_in_range = true
                vars.hostile_out_of_range = false
            } else {
                vars.hostile_in_range = false
                vars.hostile_out_of_range = true
            }
        } else {
            if (vars.is_my_hostile) {
                vars.hostile_out_of_range = true
                vars.hostile_seen = false
                vars.hostile_in_range = false
            } else {
                vars.hostile_seen = false
                vars.hostile_out_of_range = true
                vars.hostile_in_range = false
                vars.is_my_hostile = false
                vars.same_hostile_ask_backup = 0
                
                if (vars.hostile) {
                    if (vars.hostile.attrs.hp.pos <= 0) {
                        vars.hostile_terminated = true
                        vars.hostile = undefined
                    }
                }
                
                if (!vars.squad && !vars.no_squad) {
                    if (currentAgent.generator.eventOccurs(0.05)) {
                        vars.no_squad = true
                        vars.t = 0
                        vars.pkt_ok = false
                        vars.pkt_fail = false
                        var lvl = currentAgent.attrs.hp.max <= 22
                        vars.low_level = lvl
                        vars.high_level = !lvl
                    }
                } else if (!vars.squad && vars.no_squad) {
                }
            }
        }
        
        vars.hp_low = currentAgent.attrs.hp.pos <= currentAgent.attrs.hp.max*0.1
    }
    
    //console.log(vars)
}

var lastRadioSoundIdx = 0
var numRadioSounds = 4
function randomRadioSound(x, y) {
    soundManager.addSound(x, y, 15, "radio00" + (lastRadioSoundIdx + 1), 0)
    lastRadioSoundIdx = (lastRadioSoundIdx + 1) % numRadioSounds
    particles.Singleton().spawnParticle(
        x, y, x, y+4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x, y-4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x+4, y+4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)    
    particles.Singleton().spawnParticle(
        x, y, x-4, y+4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x+4, y-4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x-4, y-4, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x+4, y, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
    particles.Singleton().spawnParticle(
        x, y, x-4, y, 1, "!", 
        "sound-radio",  
        "instant", undefined, 0)
}

function Marine(aiState, name, tx, ty, faction) {
    if (typeof(faction) == "undefined") {
        faction = "default"
    }
    
    if (!squadHandlersAdded) {
        var movementStep = function(agent, dx, dy) {
            var tx = agent.pos.x + dx
            var ty = agent.pos.y + dy
            
            var cmd = {}
            if ((tx >= 0) && (tx < currentLevel[0].length) && (ty >= 0) && (ty < currentLevel.length)) {
                var tile = currentLevel[ty][tx]
                
                var friendly = (typeof(tile.character) != "undefined") && 
                    (tile.character != null) &&
                    (typeof(tile.character.attrs.faction) != "undefined") &&
                    (tile.character.attrs.faction == agent.attrs.faction)
                
                // Won't walk purposefully over a damaging tile
                if (((!tile.damage) || (tile.damage <= 0)) && !friendly) {
                    var p = currentAi.passable(tile)
                    if (p == 1) {
                        cmd.dst = {x: tx, y: ty}
                    } else if (p == 2) {
                        if (((agent.pos.x != tx) && (agent.pos.y != ty))) {
                            cmd.dst = {x: tx, y: ty}
                        }
                    }
                }
            }
            
            return cmd
        }
        
        squadFsm.setStateProcessors({
            // Default
            'idle': function(vars) {
                vars.t++
            },
            'roam': function(vars) {
                vars.t--
                
                var nm = Math.floor(currentAgent.generator.random() * 8)
                var dx = [-1, 0, 1, -1, 1, -1, 0, 1][nm]
                var dy = [-1, -1, -1, 0, 0, 1, 1, 1][nm]

                return movementStep(currentAgent, dx, dy)
            },
            'retreat': function(vars) {
                vars.t++
                
                var dx = -util.sign(vars.hostile_position.x - currentAgent.pos.x)
                var dy = -util.sign(vars.hostile_position.y - currentAgent.pos.y)
                
                
                
                if (currentAgent.weapon.ammo == 0) {
                    var cmd = {}
                    
                    cmd.reloadWeapon = true
                    cmd.reloadAlternate = false
                    
                    return cmd
                } else {
                    return movementStep(currentAgent, dx, dy)
                }
            },
            'report_hostile': function(vars) {
                if (!vars.last_pkt && !vars.last_hostile_reported) {
                    vars.last_pkt = currentAgent.comms.transmit(currentAgent.pos.x, currentAgent.pos.y, {
                        'hostile_seen': {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    })
                    vars.pktsSent[vars.last_pkt] = true
                    randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                }
                
                return {wait: 10}
            },
            
            // Hostile Engagement
            'pursue_hostile': function(vars) {
                vars.t++
                
                var dx = util.sign(vars.hostile_position.x - currentAgent.pos.x)
                var dy = util.sign(vars.hostile_position.y - currentAgent.pos.y)
                
                return movementStep(currentAgent, dx, dy)
                
                /*var d = aiState.traverse(currentAgent, currentLevel, {preferredSpot: vars.hostile_position})
                
                return movementStep(currentAgent, d.dx, d.dy)*/
            },
            'ask_backup': function(vars) {
                if (!vars.last_pkt) {
                    if ((vars.same_hostile_ask_backup >= 0) && vars.is_my_hostile) {
                        vars.last_pkt = currentAgent.comms.transmit(currentAgent.pos.x, currentAgent.pos.y, {
                            'need_backup': {x: currentAgent.pos.x, y: currentAgent.pos.y, squad: vars.squad}
                        })
                        vars.pktsSent[vars.last_pkt] = true
                        randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                    }
                    
                    vars.same_hostile_ask_backup++
                } else {
                    vars.same_hostile_ask_backup++
                }
                
                return {wait: 10}
            },
            'engage_hostile': function(vars) {
                var cmd = {}
                // TODO: Evaluate if there's an explosive tile near the hostile, and target it instead
                if (currentAgent.weapon.ranged && currentAgent.weapon.alternate && (currentAgent.generator.random() < 0.2)) {
                    if (currentAgent.weapon.alternate.ammo == 0) {
                        cmd.reloadWeapon = true
                        cmd.reloadAlternate = true
                        
                        somethingHappened = true
                        vars.out_of_ammo = true
                    } else {
                        cmd.fireWeapon = true
                        cmd.fireAlternate = true
                        cmd.fireTarget = {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    }
                } else if (currentAgent.weapon.ranged) {
                    if (currentAgent.weapon.ammo == 0) {
                        cmd.reloadWeapon = true
                        cmd.reloadAlternate = true
                        
                        vars.out_of_ammo = true
                    } else {
                        cmd.fireWeapon = true
                        cmd.fireTarget = {x: vars.hostile_position.x, y: vars.hostile_position.y}
                    }
                }
                
                return cmd
            },
            
            // Squad management
            'squad_need': function(vars) {
                return {wait: 1}
            },
            'create_squad': function(vars) {
                vars.squad = 'lone_wolf'
                
                return {wait: 10}
            },
            'search_squad': function(vars) {
                /*vars.t++
                if (!vars.last_pkt && !vars.pkt_ok) {
                    vars.last_pkt = currentAgent.comms.transmit(currentAgent.pos.x, currentAgent.pos.y, {
                        'need_squad': {x: currentAgent.pos.x, y: currentAgent.pos.y, nonce: Math.floor(Math.random() * 0xFFFFFFFF)} // This random doesn't needs determinist
                    })
                    randomRadioSound(currentAgent.pos.x, currentAgent.pos.y)
                } else if (!vars.last_pkt && vars.pkt_ok) {*/
                    vars.squad = 'lone_wolf'
                    vars.t = 10
                //}
                
                return {wait: 10}
            },
            'pursue_squad': function(vars) {
                vars.leader_near = true // TODO: Check for leader near us
                
                return {wait: 10}
            },
            'follow_leader': function(vars) {
                vars.leader_near = true // TODO: Check for leader near us
                
                return {wait: 10}
            },
            
            // Loot picking
            'move_towards_loot': function(vars) {
            },
            'pickup_loot': function(vars) {
            },
            'drop_inventory': function(vars) {
            },
            'change_weapon': function(vars) {
            },
        })
        squadHandlersAdded = true
    }
    var hp = Math.floor(generator.random() * 15 + 15)
    var mon = aiState.instantiate(
        tx, ty, name, asciiMapping['m'], '#0C3', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 5},
            armor: {pos: 20},
            speed: {pos: 10},
            precision: {pos: 30},
            kind: "organic",
            faction: faction
        },
        {},
        [],
        function(level, ai) {
            currentAgent = this
            currentLevel = level
            currentAi = ai
            
            updateGlobalVars(this.fsmVars)
            
            /*if (this.fsmVars.currentState) {
                console.log(this.fsmVars.currentState.name)
            }*/
            
            return squadFsm.process(this.fsmVars)
        })
        
    mon.fsmVars = squadFsm.cloneVars({
        hostile_position: false,
        last_hostile_reported: false,
        hostile: undefined,
        pktsSent: {}
    })
    mon.fsmMemory = {}
    mon.currentSquad = undefined
    mon.generator = generator.child()
    
    mon.comms = comms.findChannel(faction, true)
    
    var weapons = ["9mm Pistol", "xM3 Shotgun", "xM50 Rifle", "Plasma Pistol", "Laser Pistol"]
    var weap = items.searchWeaponByName(weapons[Math.floor(generator.random() * weapons.length)]).clone()
    var chargerOrig = weap.findChargerAndAssign(items)
    weap.assignCharger(chargerOrig.clone())
    
    var numChrgrs = Math.floor(Math.pow(generator.random(), 2) * 6) + 2
    
    for (var i=0; i < numChrgrs; i++) {
        mon.inventory.push(chargerOrig.clone())
    }
    mon.weapon = weap
    
    if (generator.random() < 0.1) {
        mon.inventory.push(items.itemByName("+10 Health"))
    }
    
    if (generator.random() < 0.01) {
        mon.inventory.push(items.itemByName("+50 Health"))
    }
        
    return mon
}

function Monsta(aiState, name, tx, ty) {
    var hp = Math.floor(generator.random() * 25 + 5)
    var ai = aiState.instantiate(
        tx, ty, name, asciiMapping['m'], '#f60', 
        {
            hp: {pos: 10, max: 10},
            strength: {pos: 10},
            armor: {pos: 10},
            speed: {pos: 30},
            precision: {pos: 10},
            kind: "organic"
        },
        {},
        [])
        
    var weapons = ["9mm Pistol", "xM3 Shotgun", "Flamethrower", "xM50 Rifle", "H80 RPG Launcher"]
    var weap = items.searchWeaponByName(weapons[Math.floor(generator.random() * weapons.length)]).clone()
    var chargerOrig = weap.findChargerAndAssign(items)
    weap.assignCharger(chargerOrig.clone())
    
    var numChrgrs = Math.floor(Math.pow(generator.random(), 2) * 6) + 2
    
    for (var i=0; i < numChrgrs; i++) {
        ai.inventory.push(chargerOrig.clone())
    }
    ai.weapon = weap
    
    if (generator.random() < 0.1) {
        ai.inventory.push(items.itemByName("+10 Health"))
    }
    
    if (generator.random() < 0.01) {
        ai.inventory.push(items.itemByName("+50 Health"))
    }
        
    return ai
}

function Drone(aiState, name, tx, ty) {
    var hp = Math.floor(generator.random() * 5) + 1
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['d'], '#ff0', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: Math.floor(generator.random() * 10)},
            armor: {pos: Math.floor(generator.random() * 10)},
            knockbackFactor: 3,
            kind: "robotic"
        },
        {},
        [])
}

function Tracer(aiState, name, tx, ty) {
    var hp = Math.floor(generator.random() * 10) + 5
    var ai = aiState.instantiate(tx, ty, name, asciiMapping['t'], '#f38', 
        {
            hp: {pos: hp, max: hp},
            strength: {pos: 40},
            armor: {pos: 0},
            speed: {pos: 50},
            knockbackFactor: 0.1,
            kind: "robotic"
        },
        {},
        [],
        function (level) {
            var ret = {x: 0, y: 0}
            if (this.ndir > 0) {
                this.ndir--
                ret.x = this.tdir.x
                ret.y = this.tdir.y
            } else {
                this.ndir = Math.floor(generator.random() * 15) + 5
                var nm = Math.floor(generator.random() * 8)
                var dx = [-1, 0, 1, -1, 1, -1, 0, 1][nm]
                var dy = [-1, -1, -1, 0, 0, 1, 1, 1][nm]
                this.tdir = {
                    x: dx,
                    y: dy
                }
            }
            
            return ret
        })
    ai.ndir = 0
    ai.tdir = {x: 0, y: 0}
    
    return ai
}

module.exports = {
    spawners: {
        /*Monsta: Monsta,
        Drone: Drone,
        Tracer: Tracer,*/
        Marine: Marine
    },
    registerGenerator: registerGenerator
}