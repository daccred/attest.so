/**
 * AttestSDKResponse type definition.
 * @template T - The type of the data in the response.
 */
export type AttestSDKResponse<T = undefined> =
  | {
      data: T
      error?: undefined
    }
  | {
      data?: undefined
      error: any
    }

/**
 * AttestSDKBaseConfig type definition.
 */
export type AttestSDKBaseConfig = {
  secretKey: number[]
  url?: string
}
