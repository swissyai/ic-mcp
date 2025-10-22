actor Counter {
  stable var counter : Nat = 0;

  public query func get() : async Nat {
    counter
  };

  public func increment() : async () {
    counter += 1;
  };

  public func decrement() : async () {
    if (counter > 0) {
      counter -= 1;
    };
  };
}
