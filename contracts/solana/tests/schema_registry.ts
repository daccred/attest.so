import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SchemaRegistry } from "../target/types/schema_registry";

describe("resolver", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SchemaRegistry as Program<SchemaRegistry>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("[resolver]: Your transaction signature", tx);
  });
});
