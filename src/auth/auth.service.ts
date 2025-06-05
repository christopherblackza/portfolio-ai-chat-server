import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { supabase } from '../supabase/supabase-client';

@Injectable()
export class AuthService {
  private supabaseUrl = process.env.SUPABASE_URL;
  private supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  

  async signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) throw new Error(error.message);
    return data; // Contains `user` and `session`
  }

  async refreshSession(refreshToken: string): Promise<{ user: any; session: any }> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Supabase configuration is missing');
    }

    try {
      const response = await axios.post(
        `${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          refresh_token: refreshToken,
        },
        {
          headers: {
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        user: response.data.user,
        session: response.data,
      };
    } catch (error) {
      console.error('Error refreshing session:', error);
      throw new Error('Failed to refresh session');
    }
  }

  async signOut(accessToken: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Supabase configuration is missing');
    }

    try {
      await axios.post(
        `${this.supabaseUrl}/auth/v1/logout`,
        {},
        {
          headers: {
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Failed to sign out');
    }
  }
}