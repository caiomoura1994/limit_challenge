class VehicleConflictError(Exception):
    def __init__(self, conflicts: list[str]):
        self.conflicts = conflicts
        super().__init__(", ".join(conflicts))
