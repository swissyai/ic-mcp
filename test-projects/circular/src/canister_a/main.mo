import CanisterB "canister:canister_b";

actor CanisterA {
  public func callB() : async Nat {
    await CanisterB.getValueFromA()
  };

  public query func getValue() : async Nat {
    42
  };
}
