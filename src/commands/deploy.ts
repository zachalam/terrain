import { Command, flags } from "@oclif/command";
import {
  LCDClient,
  LocalTerra,
  MnemonicKey,
  Wallet,
} from "@terra-money/terra.js";
import { loadConfig, loadKeys } from "../config";
import { instantiate, storeCode } from "../lib/deploy";
import * as path from "path";
import { cli } from "cli-ux";

// TODO: depends on configuration

const localterra = new LocalTerra();

const lcdClientConfig = {
  localterra: {
    URL: "http://localhost:1317",
    chainID: "localterra",
  },
};

export default class Deploy extends Command {
  static description = "store code on chain and instantiate";

  static flags = {
    "no-rebuild": flags.boolean({ default: false }),
    network: flags.string({ default: "localterra" }),
    "config-path": flags.string({ default: "./config.terrain.json" }),
    "keys-path": flags.string({ default: "./keys.terrain.js" }),
    "instance-id": flags.string({ default: "default" }),
    signer: flags.string({ required: true }),
  };

  static args = [{ name: "contract", required: true }];

  async run() {
    const { args, flags } = this.parse(Deploy);

    const config = loadConfig(flags["config-path"]);

    const conf = config(flags.network, args.contract);

    // @ts-ignore
    const terra = new LCDClient(lcdClientConfig[flags.network]);

    // TODO: construct this from config instead
    let signer: Wallet;

    if (
      flags.network === "localterra" &&
      flags.signer &&
      localterra.wallets.hasOwnProperty(flags.signer)
    ) {
      this.log(
        `using pre-baked '${flags.signer}' wallet on localterra as signer`
      );
      // @ts-ignore
      signer = localterra.wallets[flags.signer];
    } else {
      const keys = loadKeys(path.join(process.cwd(), flags["keys-path"]));

      if (!keys[flags.signer]) {
        cli.error(`Key for '${flags.signer}' does not exists.`);
      }

      signer = new Wallet(terra, keys[flags.signer]);
    }

    const codeId = await storeCode({
      conf,
      noRebuild: flags["no-rebuild"],
      contract: args.contract,
      signer,
      network: flags.network,
      configPath: flags["config-path"],
      lcd: terra,
    });

    // TODO: only allow snake case validation (also in new)
    // config file: admin, signer,

    instantiate({
      conf,
      signer,
      contract: args.contract,
      codeId,
      network: flags.network,
      instanceId: flags["instance-id"],
      configPath: flags["config-path"],
      lcd: terra,
    });
  }
}
