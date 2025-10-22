import Database "canister:database";

actor Backend {
  public func saveUser(name : Text) : async Nat {
    await Database.add(name)
  };

  public query func getUser(id : Nat) : async ?Text {
    await Database.get(id)
  };

  public query func count() : async Nat {
    await Database.count()
  };
}
