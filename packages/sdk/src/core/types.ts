export type AttestSDKResponse<T = undefined> = {
  error?: any;
  data?: T;
};

export type AttgestSDKResponse<T = undefined> =
  | {
      data: T;
      error?: undefined;
    }
  | {
      data?: undefined;
      error: any;
    };

export type AttestSDKBaseConfig = {
  privateKey?: string;
};
