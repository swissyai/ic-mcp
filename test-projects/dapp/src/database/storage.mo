import Array "mo:core/Array";
import Nat "mo:core/Nat";

actor Database {
  stable var users : [Text] = [];

  public func add(name : Text) : async Nat {
    users := Array.append(users, [name]);
    users.size() - 1
  };

  public query func get(id : Nat) : async ?Text {
    if (id < users.size()) {
      ?users[id]
    } else {
      null
    }
  };

  public query func count() : async Nat {
    users.size()
  };
}
