/// Module: constants
module sas::constants {
    // === Constants ===
    const CURRENT_VERSION: u64 = 1;

    // === Public-View Functions ===
    public fun current_version(): u64 {
        CURRENT_VERSION
    }
}