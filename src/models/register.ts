import { discoverModels } from "@getstrata/bootstrap/discoverModels";

// Discovery binds default repositories and registers every name before model boot.
await discoverModels(import.meta.dir);
