use anchor_lang::{prelude::*, solana_program::system_program};
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("tokdh9ZbWPxkFzqsKqeAwLDk6J6a8NBZtQanVuuENxa");

#[program]
pub mod tokadapt {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        admin_authority: Pubkey,
        input_mint: Pubkey,
    ) -> ProgramResult {
        ctx.accounts.process(admin_authority, input_mint)
    }

    pub fn swap(ctx: Context<Swap>, amount: u64) -> ProgramResult {
        ctx.accounts.process(amount)
    }

    pub fn set_admin(ctx: Context<SetAdmin>, new_admin_authority: Pubkey) -> ProgramResult {
        ctx.accounts.process(new_admin_authority)
    }

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        ctx.accounts.process()
    }
}

#[account]
pub struct State {
    pub admin_authority: Pubkey,
    pub input_mint: Pubkey,
    pub output_storage: Pubkey,
    pub output_storage_authority_bump: u8,
}

impl State {
    pub const OUTPUT_STORAGE_AUTHORITY_SEED: &'static [u8] = b"storage";
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(zero, rent_exempt = enforce)]
    pub state: Account<'info, State>,
    #[account()]
    pub output_storage: Account<'info, TokenAccount>,
}

impl<'info> Initialize<'info> {
    pub fn process(&mut self, admin_authority: Pubkey, input_mint: Pubkey) -> ProgramResult {
        let (output_storage_authority, output_storage_authority_bump) =
            Pubkey::find_program_address(
                &[
                    State::OUTPUT_STORAGE_AUTHORITY_SEED,
                    &self.state.key().to_bytes(),
                ],
                &ID,
            );
        if self.output_storage.owner != output_storage_authority {
            msg!(
                "Expected output storage authority to be {}",
                output_storage_authority
            );
            return Err(ErrorCode::OutputStorageAuthorityDoesNotMatch.into());
        }
        if self.output_storage.close_authority.is_some() {
            return Err(ErrorCode::OutputStorageMustNotBeCloseable.into());
        }
        if self.output_storage.delegate.is_some() {
            return Err(ErrorCode::OutputStorageMustNotBeDelegated.into());
        }

        *self.state = State {
            admin_authority,
            input_mint,
            output_storage: self.output_storage.key(),
            output_storage_authority_bump,
        };

        Ok(())
    }
}

#[derive(Accounts)]

pub struct Swap<'info> {
    #[account(has_one = input_mint, has_one = output_storage)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub input: Account<'info, TokenAccount>,
    pub input_authority: Signer<'info>,
    #[account()]
    pub input_mint: Account<'info, Mint>,
    #[account(mut)]
    pub output_storage: Account<'info, TokenAccount>,
    #[account(
        seeds = [State::OUTPUT_STORAGE_AUTHORITY_SEED, &state.key().to_bytes()],
        bump = state.output_storage_authority_bump
    )]
    pub output_storage_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub target: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Swap<'info> {
    pub fn process(&self, mut amount: u64) -> ProgramResult {
        if self.input.mint != self.state.input_mint {
            msg!("Expected input mint {}", self.state.input_mint);
            return Err(ErrorCode::InvalidInputMint.into());
        }

        // if amount == u64::MAX => max available / max delegated
        if self.input.owner == self.input_authority.key() {
            if amount == u64::MAX {
                amount = self.input.amount
            }
        } else {
            if !self.input.delegate.contains(&self.input_authority.key()) {
                return Err(ErrorCode::InvalidInputAuthority.into());
            }
            if amount == u64::MAX {
                amount = self.input.delegated_amount;
            }
        }

        if amount > self.output_storage.amount {
            msg!("Requested swap {}/{}", amount, self.output_storage.amount);
            return Err(ProgramError::InsufficientFunds);
        }

        // burn intermediate token
        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Burn {
                    mint: self.input_mint.to_account_info(),
                    to: self.input.to_account_info(),
                    authority: self.input_authority.to_account_info(),
                },
            ),
            amount,
        )?;

        // transfer from storage to target
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.output_storage.to_account_info(),
                    to: self.target.to_account_info(),
                    authority: self.output_storage_authority.to_account_info(),
                },
                &[&[
                    State::OUTPUT_STORAGE_AUTHORITY_SEED,
                    &self.state.key().to_bytes(),
                    &[self.state.output_storage_authority_bump],
                ]],
            ),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(mut, has_one = admin_authority)]
    pub state: Account<'info, State>,
    pub admin_authority: Signer<'info>,
}

impl<'info> SetAdmin<'info> {
    pub fn process(&mut self, new_admin_authority: Pubkey) -> ProgramResult {
        self.state.admin_authority = new_admin_authority;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, has_one = admin_authority, has_one = output_storage, close = rent_collector)]
    pub state: Account<'info, State>,
    pub admin_authority: Signer<'info>,
    #[account(mut)]
    pub output_storage: Account<'info, TokenAccount>,
    #[account(
        seeds = [State::OUTPUT_STORAGE_AUTHORITY_SEED, &state.key().to_bytes()],
        bump = state.output_storage_authority_bump
    )]
    pub output_storage_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_target: Account<'info, TokenAccount>,
    #[account(mut, owner = system_program::ID)]
    pub rent_collector: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Close<'info> {
    pub fn process(&mut self) -> ProgramResult {
        if self.token_target.key() == self.state.output_storage.key() {
            return Err(ErrorCode::InvalidCloseTokenTarget.into());
        }
        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.output_storage.to_account_info(),
                    to: self.token_target.to_account_info(),
                    authority: self.output_storage_authority.to_account_info(),
                },
                &[&[
                    State::OUTPUT_STORAGE_AUTHORITY_SEED,
                    &self.state.key().to_bytes(),
                    &[self.state.output_storage_authority_bump],
                ]],
            ),
            self.output_storage.amount,
        )?;

        token::close_account(CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            token::CloseAccount {
                account: self.output_storage.to_account_info(),
                destination: self.rent_collector.to_account_info(),
                authority: self.output_storage_authority.to_account_info(),
            },
            &[&[
                State::OUTPUT_STORAGE_AUTHORITY_SEED,
                &self.state.key().to_bytes(),
                &[self.state.output_storage_authority_bump],
            ]],
        ))?;

        **self
            .rent_collector
            .to_account_info()
            .lamports
            .as_ref()
            .borrow_mut() += self.state.to_account_info().lamports();
        **self.state.to_account_info().lamports.as_ref().borrow_mut() = 0;

        Ok(())
    }
}

#[error]
pub enum ErrorCode {
    #[msg("Treasury token authority does not match")]
    OutputStorageAuthorityDoesNotMatch,
    #[msg("Treasury token account must not be closeable")]
    OutputStorageMustNotBeCloseable,
    #[msg("Treasury token account must not be delegated")]
    OutputStorageMustNotBeDelegated,
    #[msg("Invalid input mint")]
    InvalidInputMint,
    #[msg("Invalid input authority")]
    InvalidInputAuthority,
    #[msg("Close token target must differ from storage")]
    InvalidCloseTokenTarget,
}
