"""Request and response models for the StudyAbroad Ringgit Coach API.

Rates are annual decimals (3% = 0.03). Exchange rates are MYR per 1 foreign unit.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from finance import Inputs

SensField = Literal["cost_foreign", "months", "spot", "i_my", "i_f", "pi_my", "pi_f"]


class InputsModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cost_foreign: float = Field(gt=0, le=10_000_000,
                                description="Total cost at today's prices, foreign currency")
    months: int = Field(ge=1, le=36, description="Months until departure")
    spot: float = Field(gt=0, le=1_000, description="S0, MYR per 1 foreign unit")
    i_my: float = Field(ge=-0.05, le=0.5, description="Malaysian interest rate")
    i_f: float = Field(ge=-0.05, le=0.5, description="Foreign interest rate")
    pi_my: float = Field(ge=-0.05, le=0.5, description="Malaysian inflation")
    pi_f: float = Field(ge=-0.05, le=0.5, description="Foreign inflation")
    currency: str = Field(default="GBP", min_length=3, max_length=3)

    def to_inputs(self) -> Inputs:
        return Inputs(**self.model_dump())

    @classmethod
    def from_inputs(cls, x: Inputs) -> "InputsModel":
        return cls(cost_foreign=x.cost_foreign, months=int(x.months), spot=x.spot,
                   i_my=x.i_my, i_f=x.i_f, pi_my=x.pi_my, pi_f=x.pi_f,
                   currency=x.currency)


class SensitivityRequest(BaseModel):
    inputs: InputsModel
    field: SensField
    new_value: float


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    inputs: InputsModel
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


class ChatResponse(BaseModel):
    reply: str
    tool_results: list[dict]
