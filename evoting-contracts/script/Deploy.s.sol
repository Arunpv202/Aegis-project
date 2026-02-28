// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";

import "../src/ElectionRegistry.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        ElectionRegistry registry = new ElectionRegistry();
        console.log("ElectionRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
