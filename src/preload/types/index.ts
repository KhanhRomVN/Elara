export interface IAppAPI {
  ping: () => Promise<string>;
  quit: () => void;
}

export type API = {
  app: IAppAPI;
};
