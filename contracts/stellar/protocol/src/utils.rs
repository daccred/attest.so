use soroban_sdk::xdr::{Limits, ReadXdr, ScBytes, ScString, ScVal, ToXdr, WriteXdr};
use soroban_sdk::{Address, Bytes, BytesN, Env, String, FromVal};
use crate::state::{DataKey, StoredAttestation, Schema, Authority};
use crate::errors::Error;
use crate::interfaces::resolver::ResolverAttestation;


// pub fn create_xdr_string(env: &Env, value: &String) -> Result<String, Error> {
//     let val = ScVal::Symbol(ScSymbol::try_from(value.clone()).map_err(|_| Error::InvalidInput)?);
//     let xdr_bytes = val.to_xdr_base64(Limits::none()).map_err(|_| Error::InvalidInput)?;
//     let b64 = encode(&xdr_bytes);
//     String::from_str(env, &b64)
// }


////////////////////////////////////////////////////////////////////////////////////
/// DEPRECATED FUNCTIONS
////////////////////////////////////////////////////////////////////////////////////

pub fn _to_attestation_record(
   _env: &Env,
   _uid: &BytesN<32>,
   _att: &StoredAttestation,
) -> ResolverAttestation {
   unimplemented!("to_attestation_record needs update/removal");
}

pub fn _generate_attestation_uid(
   _env: &Env,
   _schema_uid: &BytesN<32>,
   _subject: &Address,
   _reference: &Option<String>,
) -> Result<BytesN<32>, Error> {
   unimplemented!("generate_attestation_uid needs update/removal");
} 

/// Retrieves an authority record by address.
///
/// **DEPRECATED**: This function is being deprecated in favor of the authority resolver
/// which is implemented as a separate contract outside of this protocol contract.
/// New implementations should use the authority resolver contract for authority
/// management and validation.
///
/// # Arguments
/// * `env` - The Soroban environment providing access to storage operations
/// * `address` - The address of the authority to retrieve
///
/// # Returns
/// * `Option<Authority>` - The `Authority` record if found, otherwise `None`
///
/// # Example
/// ```ignore
/// if let Some(authority) = _get_authority(&env, &authority_address) {
///     // Authority exists, can proceed with operations
/// } else {
///     // Authority not found, handle accordingly
/// }
/// ```
pub fn _get_authority(env: &Env, address: &Address) -> Option<Authority> {
    let key = DataKey::Authority(address.clone());
    env.storage().instance().get(&key)
}

/// Retrieves a schema record by its unique identifier (UID).
///
/// # Arguments
/// * `env` - The Soroban environment.
/// * `schema_uid` - The 32-byte unique identifier of the schema to retrieve.
///
/// # Returns
/// * `Option<Schema>` - The `Schema` record if found, otherwise None.
///
/// # Example
/// ```ignore
/// if let Some(schema) = get_schema(&env, &schema_uid) {
///     // Schema exists, use it
/// } else {
///     // Schema not found
/// }
/// ```
pub fn get_schema(env: &Env, schema_uid: &BytesN<32>) -> Option<Schema> {
    let key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().get(&key)
}



/// Gets the next nonce for an attester.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address of the attester
///
/// # Returns
/// * `u64` - The next nonce to be used
pub fn get_next_nonce(env: &Env, attester: &Address) -> u64 {
    let nonce_key = DataKey::AttesterNonce(attester.clone());
    env.storage().persistent()
        .get::<DataKey, u64>(&nonce_key)
        .unwrap_or(0)
}


/// Creates XDR bytes from a string.
///
/// This utility function converts a string value into raw XDR bytes. 
/// This is the standard format for working with XDR data in Soroban contracts.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `value` - A string value to convert to XDR
///
/// # Returns   
/// * `String` - String encoded in base64 XDR bytes representation of the string
///
/// # Example
/// ```ignore
/// let some_string = String::from_str(&env, "hello world");
/// let xdr_bytes = create_xdr_string(&env, &some_string);
/// // Returns raw XDR bytes that can be used for hashing or storage
/// ```
pub fn create_xdr_string(env: &Env, value: &String) -> String {
  let xdr_bytes = value.clone().to_xdr(env);


  // Wrap the hash in an ScVal
  let hash: BytesN<32> = env.crypto().sha256(&xdr_bytes).into();
  let bytes = Bytes::from_slice(env, &hash.to_array());
  // This returns a std::string::String.
  let base64_std_string = bytes.to_xdr_base64(Limits::none()).unwrap();

  // Convert the std::string::String to a soroban_sdk::String
  String::from_str(env, &base64_std_string)
}


 