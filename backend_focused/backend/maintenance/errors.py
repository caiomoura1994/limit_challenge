class MechanicCertificationConflictError(Exception):
    pass


class MaintenanceRecordRuleError(Exception):
    def __init__(self, errors: dict[str, list[str]]):
        self.errors = errors
        super().__init__(str(errors))
