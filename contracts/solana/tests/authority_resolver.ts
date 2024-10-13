import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AuthorityResolver } from "../target/types/authority_resolver";

describe("resolver", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.AuthorityResolver as Program<AuthorityResolver>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("[resolver]: Your transaction signature", tx);
  });
});
