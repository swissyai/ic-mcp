import CanisterA "canister:canister_a";

actor CanisterB {
  public func getValueFromA() : async Nat {
    await CanisterA.getValue()
  };

  public query func ping() : async Text {
    "pong"
  };
}
